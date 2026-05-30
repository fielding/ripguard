"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import {
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { Header } from "@/components/Header";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MobileWalletFallback } from "@/components/MobileWalletFallback";
import { useToast } from "@/components/Toast";
import {
  PRESETS,
  SOL_DECIMALS,
  DEPOSIT_TOKEN_LABEL,
  IS_DEVNET,
  computeBrokerFee,
  explorerTx,
  explorerAccount,
  type PresetKey,
} from "@/config/solsab";
import { buildLockTx } from "@/sol/lock";
import { buildUnwrapWsolIxs } from "@/sol/unwrap";
import { randomSalt } from "@/sol/pdas";
import {
  presetToSolanaArgs,
  customScheduleToSolanaArgs,
} from "@/sol/preset";
import {
  trackLockApproved,
  trackLockCreated,
  trackContractError,
} from "@/lib/analytics";
import { isUserRejection, extractErrorReason } from "@/lib/errors";
import {
  DURATION_OPTIONS,
  MIN_LOCK_SECONDS,
  getIntervalOptions,
  parsePositiveDurationParam,
  parseLockUntilInput,
  formatDuration,
  formatTargetDate,
  toDatetimeLocalValue,
  calculatePayoutSchedule,
} from "@/lib/schedule";

// SOL has 9 decimals (1 SOL = 1e9 lamports). Display 4 decimals max so
// the form stays readable; trim trailing zeros for a clean look.
const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
const AMOUNT_RE = new RegExp(`^\\d+(\\.\\d{1,${SOL_DECIMALS}})?$`);

// Headroom kept aside for tx fee + ATA rent + a buffer so the wallet
// doesn't go to literal zero. Lock tx pays the wSOL ATA rent (~0.00204
// SOL) plus a few thousand lamports of tx fee. 0.005 SOL is safe and
// also reserves enough for the eventual claim's Sablier fee + tx fee.
const LOCK_HEADROOM_LAMPORTS = BigInt(5_000_000); // 0.005 SOL

function parseSolAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!AMOUNT_RE.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "000000000").slice(0, SOL_DECIMALS);
  try {
    return BigInt(whole) * LAMPORTS_PER_SOL + BigInt(padded);
  } catch {
    return null;
  }
}

function formatSol(units: bigint): string {
  const whole = units / LAMPORTS_PER_SOL;
  const frac = units % LAMPORTS_PER_SOL;
  if (frac === 0n) return whole.toString();
  // Keep up to 4 fractional digits visible — past that is dust.
  const padded = frac.toString().padStart(SOL_DECIMALS, "0");
  const trimmed = padded.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
}

type Status =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "signing" }
  | { kind: "confirming"; signature: string }
  | { kind: "success"; signature: string; streamNftMint: string }
  | { kind: "error"; message: string };

type ScheduleSelection = PresetKey | "custom";
type CustomMode = "reloads" | "lockUntil";

// Sensible default for the lock-until picker: 7 days from "now" at the
// minute the page rendered. Captured once per mount so the input doesn't
// drift each second.
function defaultLockUntilValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setSeconds(0, 0);
  return toDatetimeLocalValue(d);
}

function CreateForm() {
  const params = useSearchParams();
  const presetParam = params.get("preset") as PresetKey | null;
  const modeParam = params.get("mode");
  const customCliffParam = parsePositiveDurationParam(params.get("cliff"));
  const customTotalParam = parsePositiveDurationParam(params.get("total"));
  const isCustomFromQuery = modeParam === "custom" && customTotalParam !== null;

  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();

  const [selectedPreset, setSelectedPreset] = useState<ScheduleSelection>(
    isCustomFromQuery
      ? "custom"
      : presetParam && presetParam in PRESETS
        ? presetParam
        : "hourly1d",
  );
  const [customCliff, setCustomCliff] = useState(customCliffParam ?? 0);
  const [customTotal, setCustomTotal] = useState(customTotalParam ?? 3600);
  const [customInterval, setCustomInterval] = useState(3600);
  const [customMode, setCustomMode] = useState<CustomMode>("reloads");
  const [lockUntilInput, setLockUntilInput] = useState<string>(defaultLockUntilValue);
  // Tick "now" once every 30s so the lock-until duration preview
  // doesn't go stale while the form is open.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-correct invalid custom combinations (mirrors EVM /create logic).
  // Only applies in reloads mode — lock-until derives total from the picker.
  useEffect(() => {
    if (customMode !== "reloads") return;
    if (customTotal < 3600) {
      setCustomTotal(3600);
    } else if (customCliff > customTotal) {
      setCustomTotal(customCliff);
    }
  }, [customCliff, customTotal, customMode]);

  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [solBalance, setSolBalance] = useState<bigint | null>(null);
  // Pre-existing wrapped SOL in the user's wSOL ATA. Our lock flow
  // wraps native SOL during the tx, so wSOL doesn't get used unless
  // the user unwraps first. Surface it separately so users with wSOL
  // (e.g. swapped from another token) aren't confused by a 0 native
  // balance.
  const [wsolBalance, setWsolBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [unwrapping, setUnwrapping] = useState(false);

  const amount = useMemo(() => parseSolAmount(amountStr), [amountStr]);
  const fee = amount !== null ? computeBrokerFee(amount) : 0n;
  const net = amount !== null ? amount - fee : 0n;

  // Parsed lock-until target (null when the picker is empty / past /
  // too soon). Memoized to one read of `nowMs` per tick so the rest of
  // the form sees a stable view of the schedule.
  const lockUntilParsed = useMemo(
    () =>
      selectedPreset === "custom" && customMode === "lockUntil"
        ? parseLockUntilInput(lockUntilInput, nowMs)
        : null,
    [selectedPreset, customMode, lockUntilInput, nowMs],
  );

  // Resolve the active schedule (preset or custom). Sablier requires
  // cliff < total strictly, so for the lump-sum case (cliff === total)
  // we add 1 second to total — same workaround the EVM side uses.
  const schedule = useMemo<{
    cliffSeconds: number;
    totalSeconds: number;
    label: string;
    isLumpSum: boolean;
    targetMs: number | null;
  }>(() => {
    if (selectedPreset !== "custom") {
      const args = presetToSolanaArgs(selectedPreset);
      const preset = PRESETS[selectedPreset];
      return {
        cliffSeconds: args.cliffSeconds,
        totalSeconds: args.totalSeconds,
        label: preset.label,
        isLumpSum: preset.isLumpSum,
        targetMs: null,
      };
    }
    if (customMode === "lockUntil") {
      if (!lockUntilParsed) {
        // Picker not yet valid → totalSeconds = 0 keeps the lock button
        // disabled until they pick a real date.
        return {
          cliffSeconds: 0,
          totalSeconds: 0,
          label: "Lock until …",
          isLumpSum: true,
          targetMs: null,
        };
      }
      const total = lockUntilParsed.durationSeconds;
      return {
        cliffSeconds: total - 1,
        totalSeconds: total,
        label: `Lock until ${formatTargetDate(lockUntilParsed.targetMs)}`,
        isLumpSum: true,
        targetMs: lockUntilParsed.targetMs,
      };
    }
    const cliffEqualsTotal = customCliff === customTotal && customCliff > 0;
    return {
      cliffSeconds: customCliff,
      totalSeconds: cliffEqualsTotal ? customTotal + 1 : customTotal,
      label: "Custom Reloads",
      isLumpSum: cliffEqualsTotal,
      targetMs: null,
    };
  }, [selectedPreset, customMode, customCliff, customTotal, lockUntilParsed]);

  const isPending =
    status.kind === "building" ||
    status.kind === "signing" ||
    status.kind === "confirming";

  // Fetch SOL balance whenever the wallet connects or after a successful
  // lock so the displayed number stays honest. Cluster is whatever the
  // ConnectionProvider points at — if the user's wallet is set to a
  // different cluster, the balance read here will be 0 even when their
  // wallet actually has funds elsewhere. We use that signal below to
  // surface a "wrong network?" hint instead of letting the lock fail
  // with the cryptic "Attempt to debit an account..." preflight error.
  const refreshBalance = useCallback(async () => {
    if (!wallet.publicKey) {
      setSolBalance(null);
      setWsolBalance(null);
      return;
    }
    setBalanceLoading(true);
    try {
      // Run native + wSOL balance reads in parallel. The wSOL read can
      // throw if the ATA doesn't exist — that just means 0 wSOL.
      const wsolAta = getAssociatedTokenAddressSync(
        NATIVE_MINT,
        wallet.publicKey,
      );
      const [lamports, wsolAmount] = await Promise.all([
        connection.getBalance(wallet.publicKey, "confirmed"),
        connection
          .getTokenAccountBalance(wsolAta, "confirmed")
          .then((r) => BigInt(r.value.amount))
          .catch(() => 0n),
      ]);
      // eslint-disable-next-line no-console
      console.info("[ripguard] balance check", {
        rpc: connection.rpcEndpoint,
        cluster: IS_DEVNET ? "devnet" : "mainnet-beta",
        pubkey: wallet.publicKey.toBase58(),
        lamports,
        wsolLamports: wsolAmount.toString(),
      });
      setSolBalance(BigInt(lamports));
      setWsolBalance(wsolAmount);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[ripguard] balance check failed", err);
      setSolBalance(null);
      setWsolBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => {
    if (wallet.connected) refreshBalance();
    else setSolBalance(null);
  }, [wallet.connected, refreshBalance]);

  // Pre-flight balance check. Returns null on pass, error string on
  // fail. Avoids the cryptic preflight blob by catching the empty /
  // underfunded case before we even build the tx.
  const balanceShortfall = useMemo(() => {
    if (amount === null || amount <= 0n) return null;
    if (solBalance === null) return null;
    const required = amount + LOCK_HEADROOM_LAMPORTS;
    if (solBalance < required) {
      const need = required - solBalance;
      return {
        required,
        haveSol: formatSol(solBalance),
        needSol: formatSol(amount),
        shortSol: formatSol(need),
      };
    }
    return null;
  }, [amount, solBalance]);

  // Heuristic: connected wallet but balance reads 0 lamports on this
  // cluster. Strongest signal is "user funded a wallet on devnet but
  // the site is mainnet" (or vice versa). Pre-empt the Phantom error
  // with a helpful nudge.
  const networkHint =
    wallet.connected && solBalance !== null && solBalance === 0n;
  // Special case: native SOL is empty but the user has wSOL sitting in
  // their ATA. Our lock flow wraps native SOL during the tx, so it
  // can't use pre-existing wSOL — they need to unwrap first. This
  // catches users who swapped into wSOL from another token and
  // assumed it'd be picked up automatically.
  const wsolOnlyHint =
    wallet.connected &&
    solBalance !== null &&
    solBalance === 0n &&
    wsolBalance !== null &&
    wsolBalance > 0n;

  // Unwrap the user's wSOL back to native SOL in-app by closing their
  // wSOL ATA. The close tx itself costs a tiny fee (~5000 lamports), so
  // a wallet at literally 0 native SOL can't pay for it — we surface
  // that case to the user rather than letting it fail opaquely.
  const onUnwrap = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.toast("Connect a Solana wallet first.", "error");
      return;
    }
    setUnwrapping(true);
    try {
      const tx = new Transaction();
      for (const ix of buildUnwrapWsolIxs(wallet.publicKey)) tx.add(ix);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("processed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      const signed = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        { maxRetries: 5, skipPreflight: false, preflightCommitment: "confirmed" },
      );
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      toast.toast("Unwrapped to native SOL.", "success");
      await refreshBalance();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (isUserRejection(e)) return;
      toast.toast(extractErrorReason(e), "error");
    } finally {
      setUnwrapping(false);
    }
  }, [wallet, connection, toast, refreshBalance]);

  const onSubmit = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.toast("Connect a Solana wallet first.", "error");
      return;
    }
    if (amount === null || amount <= 0n) {
      toast.toast(`Enter a valid ${DEPOSIT_TOKEN_LABEL} amount.`, "error");
      return;
    }
    // Catch underfunded wallets before they hit Phantom — saves them
    // from the "Attempt to debit an account..." mystery message.
    if (balanceShortfall) {
      toast.toast(
        `Your wallet has ${balanceShortfall.haveSol} SOL. You need ${balanceShortfall.needSol} for the lock plus ~0.005 SOL for fees and rent.`,
        "error",
      );
      return;
    }

    try {
      setStatus({ kind: "building" });
      trackLockApproved(Number(formatSol(amount)));

      // Anchor needs a wallet-shaped object; the adapter exposes the right
      // fields but not the exact `Wallet` type, so we adapt.
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction.bind(wallet),
        signAllTransactions: wallet.signAllTransactions
          ? wallet.signAllTransactions.bind(wallet)
          : async () => {
              throw new Error("Wallet does not support signAllTransactions.");
            },
        payer: undefined as never,
      };
      const provider = new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
      });

      const salt = randomSalt();
      // Branch on preset vs custom — both produce the same shape, but
      // custom validates cliff < total before we get into the builder.
      const scheduleArgs =
        selectedPreset === "custom"
          ? customScheduleToSolanaArgs({
              cliffSeconds: schedule.cliffSeconds,
              totalSeconds: schedule.totalSeconds,
            })
          : presetToSolanaArgs(selectedPreset);

      const { instructions, pdas, feeAmount, netDepositAmount } =
        await buildLockTx({
          provider,
          signer: wallet.publicKey,
          recipient: wallet.publicKey, // RipGuard's locked-self pattern
          depositAmount: amount,
          cliffSeconds: scheduleArgs.cliffSeconds,
          totalSeconds: scheduleArgs.totalSeconds,
          salt,
        });

      // Assemble a legacy Transaction. Solana v0 transactions add lookup
      // tables we don't need yet — keep it simple until we hit the account
      // limit.
      if (!wallet.signTransaction) {
        throw new Error("Wallet does not support signTransaction.");
      }
      const tx = new Transaction();
      for (const ix of instructions) tx.add(ix);
      // Use `processed` for the blockhash so we get the freshest possible
      // tip — buys ~30 extra slots of validity vs `confirmed`, which the
      // Phantom warning popup eats up while the user reads it.
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("processed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      // Have Phantom sign only — DON'T let Phantom broadcast. Phantom's
      // RPC isn't stake-weighted; under any contention, leaders silently
      // drop our tx and we hit "block height exceeded" without it ever
      // reaching the chain. Broadcasting through our own Helius endpoint
      // (which has stake-weighted forwarding) gets us reliable landing.
      setStatus({ kind: "signing" });
      const signed = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        {
          maxRetries: 5,
          skipPreflight: false,
          preflightCommitment: "confirmed",
        },
      );
      setStatus({ kind: "confirming", signature });

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      trackLockCreated({
        schedule: schedule.label,
        amountUsd: Number(formatSol(amount)),
        cliffSeconds: schedule.cliffSeconds,
        totalSeconds: schedule.totalSeconds,
      });
      void netDepositAmount;
      void feeAmount;

      setStatus({
        kind: "success",
        signature,
        streamNftMint: pdas.streamNftMint.toBase58(),
      });
      toast.toast("Locked.", "success");
      // Refresh balance after success so the form reflects reality if
      // the user goes back to lock again.
      void refreshBalance();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (isUserRejection(e)) {
        setStatus({ kind: "idle" });
        return;
      }
      // "Transaction has already been processed" means the wallet adapter
      // and our code both submitted, OR the user double-clicked. Either
      // way, the lock probably landed — surface it as a soft message
      // pointing at /vaults instead of a hard failure.
      if (e.message.toLowerCase().includes("already been processed")) {
        toast.toast(
          "Looks like the lock landed already. Check Vaults.",
          "info",
          { label: "Vaults", href: "/vaults" },
        );
        setStatus({ kind: "idle" });
        return;
      }
      const friendly = extractErrorReason(e);
      trackContractError({
        action: "create_with_durations_ll",
        error: friendly,
        contract: "sablier_lockup",
      });
      setStatus({ kind: "error", message: friendly });
      toast.toast(friendly, "error");
    }
  }, [
    amount,
    balanceShortfall,
    connection,
    refreshBalance,
    schedule,
    selectedPreset,
    toast,
    wallet,
  ]);

  if (status.kind === "success") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <Header />
        <section className="mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16">
          <div className="eyebrow mb-6">Locked</div>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
            Past you just paid future you<span className="text-cyan">.</span>
          </h1>
          <p className="mt-4 text-muted leading-relaxed">
            Your SOL is wrapped and locked in the Sablier Lockup program on
            Solana. Non-cancelable. Counting down on-chain regardless of
            whether RipGuard exists.
          </p>
          <dl className="mt-10 space-y-4 text-sm">
            <div>
              <dt className="text-muted">Stream NFT</dt>
              <dd>
                <a
                  href={explorerAccount(status.streamNftMint)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan break-all"
                >
                  {status.streamNftMint}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Transaction</dt>
              <dd>
                <a
                  href={explorerTx(status.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-foreground underline decoration-cyan/40 underline-offset-4 hover:decoration-cyan break-all"
                >
                  {status.signature}
                </a>
              </dd>
            </div>
          </dl>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link href="/vaults" className="btn-primary w-full sm:w-auto">
              See vaults
            </Link>
            <Link href="/create" className="btn-secondary w-full sm:w-auto">
              Lock more
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16">
        <div className="eyebrow mb-6">Create a lock</div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
          Past you<span className="text-cyan">.</span>
        </h1>
        <p className="mt-4 text-muted">
          Pick a schedule. Sign once. Your future self claims it back on the
          clock.
        </p>

        {!wallet.connected && (
          <>
            <div className="mt-8 rounded-md border border-line p-5 text-sm text-muted">
              Connect a Solana wallet from the header to start. Phantom, Solflare,
              and Backpack all work.
            </div>
            <MobileWalletFallback />
          </>
        )}

        {/* Wrapped-SOL hint. Fires before the generic empty-balance
            panel. Our lock builder wraps native SOL during the tx, so
            users who already hold wSOL (e.g. from a swap) need to
            unwrap first. Styled with a heavier border + warning chip
            so it can't be missed. */}
        {wsolOnlyHint && wsolBalance !== null && (
          <div className="mt-6 rounded-md border-2 border-warning/60 bg-warning/[0.06] p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning/20 text-warning text-sm font-bold">
                !
              </span>
              <h3 className="font-display text-lg tracking-tight text-foreground">
                You have wrapped SOL, not native SOL
              </h3>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Your wallet holds{" "}
              <span className="tabular text-foreground font-semibold">
                {formatSol(wsolBalance)} wSOL
              </span>{" "}
              but{" "}
              <span className="tabular text-foreground font-semibold">
                0 SOL
              </span>{" "}
              in native form. RipGuard wraps native SOL during the lock
              transaction, so it can&apos;t use your existing wSOL
              directly. You&apos;ll need to unwrap it first.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onUnwrap()}
                disabled={unwrapping || balanceLoading}
                className="btn-primary !min-h-[2.75rem] !py-2.5 !px-5 !text-sm disabled:opacity-50"
              >
                {unwrapping ? "Unwrapping…" : `Unwrap ${formatSol(wsolBalance)} wSOL → SOL`}
              </button>
              <button
                type="button"
                onClick={() => refreshBalance()}
                disabled={balanceLoading || unwrapping}
                className="inline-flex items-center min-h-[2.5rem] px-2 text-sm text-cyan hover:text-foreground underline transition-colors disabled:opacity-50"
              >
                {balanceLoading ? "Refreshing…" : "Refresh balance ↻"}
              </button>
            </div>
            <p className="mt-4 text-xs text-foreground/70 leading-relaxed">
              Unwrapping is itself a Solana transaction, so it needs a
              tiny bit of native SOL (~0.001) for the fee. If your wallet
              is literally <span className="tabular">0 SOL native</span>,
              send a small amount in first, then unwrap.
            </p>
          </div>
        )}

        {/* Empty-balance diagnostic. Fires when the wallet is connected
            but our RPC reports zero balance for the connected pubkey on
            the active cluster. The user's wallet might really be empty,
            but more often it's one of three things they can fix:
            wrong account selected in the wallet, wallet set to a
            different cluster, or a transient RPC blip. We surface the
            connected pubkey + an explorer link so they can verify
            against ground truth themselves. Suppressed when the
            wsolOnlyHint above already explains the situation. */}
        {networkHint && !wsolOnlyHint && wallet.publicKey && (
          <div className="mt-6 rounded-md border border-warning/40 bg-warning/[0.04] p-4 text-sm">
            <div className="eyebrow text-warning/90 mb-1.5">
              Wallet looks empty
            </div>
            <p className="text-foreground/90 leading-relaxed">
              We see{" "}
              <span className="tabular text-foreground">
                {solBalance !== null ? formatSol(solBalance) : "—"} SOL
              </span>{" "}
              on this account on{" "}
              <strong>
                {IS_DEVNET ? "Solana devnet" : "Solana mainnet-beta"}
              </strong>
              . If your wallet says otherwise, check:
            </p>
            <ul className="mt-2 space-y-1 text-foreground/80 list-disc list-outside pl-5">
              <li>
                That this is the account you expected. Phantom can hold
                several. Connected:{" "}
                <a
                  href={explorerAccount(wallet.publicKey.toBase58())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline decoration-warning/50 hover:decoration-warning"
                >
                  {wallet.publicKey.toBase58().slice(0, 4)}…
                  {wallet.publicKey.toBase58().slice(-4)}
                </a>
              </li>
              <li>
                That your wallet is set to{" "}
                <strong>{IS_DEVNET ? "Devnet" : "Mainnet"}</strong>
                {IS_DEVNET ? (
                  <>
                    {" "}
                    (and fund it from{" "}
                    <a
                      href="https://faucet.solana.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-warning/50 hover:decoration-warning"
                    >
                      the faucet
                    </a>
                    )
                  </>
                ) : (
                  <>, not Devnet or another network</>
                )}
              </li>
            </ul>
            <button
              type="button"
              onClick={() => refreshBalance()}
              disabled={balanceLoading}
              className="mt-3 inline-flex items-center min-h-[2.25rem] px-2 -my-2 text-xs text-muted hover:text-cyan underline transition-colors disabled:opacity-50"
            >
              {balanceLoading ? "Refreshing…" : "Refresh balance ↻"}
            </button>
          </div>
        )}

        <fieldset className="mt-10" disabled={isPending}>
          <legend className="eyebrow mb-3">Amount ({DEPOSIT_TOKEN_LABEL})</legend>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full rounded-md border border-line bg-background px-4 py-3 pr-16 text-2xl font-display tabular focus:outline-2 focus:outline-cyan focus:outline-offset-2"
              aria-invalid={amountStr.length > 0 && amount === null}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-subtle text-sm font-semibold tracking-wider">
              {DEPOSIT_TOKEN_LABEL}
            </span>
          </div>
          {amountStr.length > 0 && amount === null && (
            <p className="mt-2 text-sm text-warning">
              Enter a positive number with up to 9 decimal places.
            </p>
          )}
          {wallet.connected && (
            <div className="mt-2 flex items-center justify-between text-xs text-faint tabular">
              <span className="flex items-center gap-2 flex-wrap">
                <span>
                  Balance:{" "}
                  {balanceLoading
                    ? "loading…"
                    : solBalance === null
                      ? "—"
                      : `${formatSol(solBalance)} SOL`}
                  {wsolBalance !== null && wsolBalance > 0n && (
                    <span className="text-muted">
                      {" "}
                      · {formatSol(wsolBalance)} wSOL
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => refreshBalance()}
                  disabled={balanceLoading}
                  className="text-muted hover:text-cyan transition-colors disabled:opacity-50"
                  title="Refresh balance"
                  aria-label="Refresh balance"
                >
                  ↻
                </button>
              </span>
              {solBalance !== null && solBalance > LOCK_HEADROOM_LAMPORTS && (
                <button
                  type="button"
                  onClick={() => {
                    // Reserve the lock headroom so the wallet can still
                    // pay tx fee + rent. Convert to display units; trim
                    // trailing zeros via formatSol then back to string.
                    const max = solBalance - LOCK_HEADROOM_LAMPORTS;
                    setAmountStr(formatSol(max));
                  }}
                  className="inline-flex items-center min-h-[2.75rem] px-2 -my-2 -mr-2 text-muted hover:text-cyan underline transition-colors"
                  title="Lock everything except a small headroom for fees and rent"
                >
                  Max (keeps ~0.005 SOL for fees)
                </button>
              )}
            </div>
          )}
          {balanceShortfall && (
            <p className="mt-2 text-sm text-warning">
              Wallet has {balanceShortfall.haveSol} SOL. Need{" "}
              {balanceShortfall.needSol} SOL for this lock plus ~0.005 SOL for
              fees and rent.
            </p>
          )}
          {amount !== null && (
            <dl className="mt-4 space-y-1 text-sm tabular">
              <div className="flex justify-between text-muted">
                <dt>Fee (0.5%)</dt>
                <dd>
                  {formatSol(fee)} {DEPOSIT_TOKEN_LABEL}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Locked</dt>
                <dd className="text-foreground">
                  {formatSol(net)} {DEPOSIT_TOKEN_LABEL}
                </dd>
              </div>
            </dl>
          )}
        </fieldset>

        <fieldset className="mt-10" disabled={isPending}>
          <legend className="eyebrow mb-3">Reload</legend>
          {/* Segmented mode tabs. The "Build your own" affordance was
              previously a small text link in the corner that nobody
              found. Promoting it to an equal-weight tab makes the
              custom-schedule path discoverable. */}
          <div
            role="tablist"
            aria-label="Reload mode"
            className="grid grid-cols-2 gap-px bg-line border border-line rounded-md overflow-hidden mb-4"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedPreset !== "custom"}
              onClick={() => {
                if (selectedPreset === "custom") setSelectedPreset("hourly1d");
              }}
              className={`px-4 py-3 text-sm font-semibold tabular tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                selectedPreset !== "custom"
                  ? "bg-cyan/[0.10] text-cyan"
                  : "bg-background text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              Presets
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedPreset === "custom"}
              onClick={() => setSelectedPreset("custom")}
              className={`px-4 py-3 text-sm font-semibold tabular tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                selectedPreset === "custom"
                  ? "bg-cyan/[0.10] text-cyan"
                  : "bg-background text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              Build your own
            </button>
          </div>

          {selectedPreset === "custom" ? (
            <div className="space-y-5 border border-line rounded-md p-5 bg-surface">
              {/* Mode toggle: Reloads vs Lock-until. Sits inside the
                  custom panel so it doesn't crowd the outer Presets /
                  Build-your-own tabs. */}
              <div
                role="tablist"
                aria-label="Custom lock mode"
                className="grid grid-cols-2 gap-px bg-line border border-line rounded-md overflow-hidden"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={customMode === "reloads"}
                  onClick={() => setCustomMode("reloads")}
                  className={`px-4 py-3 text-sm font-semibold tabular tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                    customMode === "reloads"
                      ? "bg-cyan/[0.10] text-cyan"
                      : "bg-background text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  Steady reloads
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={customMode === "lockUntil"}
                  onClick={() => setCustomMode("lockUntil")}
                  className={`px-4 py-3 text-sm font-semibold tabular tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-[-2px] ${
                    customMode === "lockUntil"
                      ? "bg-cyan/[0.10] text-cyan"
                      : "bg-background text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  Lock until
                </button>
              </div>

              {customMode === "lockUntil" ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="lock-until" className="eyebrow block mb-2">
                      Unlock on
                    </label>
                    <input
                      id="lock-until"
                      type="datetime-local"
                      value={lockUntilInput}
                      min={toDatetimeLocalValue(
                        new Date(nowMs + MIN_LOCK_SECONDS * 1000),
                      )}
                      onChange={(e) => setLockUntilInput(e.target.value)}
                      className="w-full bg-background border border-line rounded-md px-4 py-3 text-sm tabular focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 focus:border-cyan/50 transition-colors"
                    />
                  </div>
                  {lockUntilParsed ? (
                    <p className="text-xs text-muted leading-relaxed">
                      Single unlock on{" "}
                      <span className="text-foreground">
                        {formatTargetDate(lockUntilParsed.targetMs)}
                      </span>
                      . Locked for{" "}
                      <span className="text-foreground tabular">
                        {formatDuration(lockUntilParsed.durationSeconds)}
                      </span>{" "}
                      from now. No reloads, no early exit.
                    </p>
                  ) : (
                    <p className="text-xs text-warning leading-relaxed">
                      Pick a date at least 1 hour from now.
                    </p>
                  )}
                  <p className="text-[11px] text-faint leading-relaxed">
                    Good for rent, bills, or any single-date deadline.
                    Cadence and waiting period don&apos;t apply.
                  </p>
                </div>
              ) : (
                <>
              {/* Total reload window */}
              <div>
                <label
                  htmlFor="total-duration"
                  className="eyebrow block mb-2"
                >
                  Reload window
                </label>
                <div className="relative">
                  <select
                    id="total-duration"
                    value={customTotal}
                    onChange={(e) => {
                      const newTotal = Number(e.target.value);
                      setCustomTotal(newTotal);
                      // If the current cadence no longer fits in the new
                      // window, drop it back to the largest one that does.
                      const valid = getIntervalOptions(newTotal);
                      if (
                        valid.length > 0 &&
                        !valid.find((i) => i.seconds === customInterval)
                      ) {
                        setCustomInterval(valid[0].seconds);
                      }
                    }}
                    className="w-full appearance-none bg-background border border-line rounded-md px-4 py-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 focus:border-cyan/50 transition-colors cursor-pointer"
                  >
                    {DURATION_OPTIONS.filter(
                      (d) => d.seconds >= customCliff,
                    ).map((d) => (
                      <option key={d.seconds} value={d.seconds}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Cadence — pills, dynamic based on chosen window */}
              <div>
                <label className="eyebrow block mb-2">Reload cadence</label>
                <div className="flex flex-wrap gap-2">
                  {getIntervalOptions(customTotal).map((i) => (
                    <button
                      key={i.seconds}
                      type="button"
                      onClick={() => setCustomInterval(i.seconds)}
                      className={`inline-flex items-center min-h-[2.75rem] px-4 rounded-md text-xs font-semibold tabular border transition-colors ${
                        customInterval === i.seconds
                          ? "border-cyan bg-cyan/10 text-cyan"
                          : "border-line bg-background text-muted hover:border-line-strong hover:text-foreground"
                      }`}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cliff (advanced) */}
              <details className="group">
                <summary className="text-xs text-faint cursor-pointer hover:text-muted transition-colors">
                  Advanced: add a waiting period before reloads start
                </summary>
                <div className="mt-3">
                  <div className="relative">
                    <select
                      value={customCliff}
                      onChange={(e) => setCustomCliff(Number(e.target.value))}
                      className="w-full appearance-none bg-background border border-line rounded-md px-4 py-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2 focus:border-cyan/50 transition-colors cursor-pointer"
                    >
                      <option value={0}>No wait</option>
                      {DURATION_OPTIONS.filter(
                        (d) => d.seconds < customTotal,
                      ).map((d) => (
                        <option key={d.seconds} value={d.seconds}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </details>

              {customCliff > customTotal && (
                <p className="text-xs text-warning">
                  The wait can&apos;t be longer than the reload window.
                </p>
              )}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                const p = PRESETS[key];
                const active = key === selectedPreset;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPreset(key)}
                    className={`text-left rounded-md border p-4 transition-colors ${
                      active
                        ? "border-cyan bg-surface"
                        : "border-line hover:border-cyan/40 hover:bg-surface"
                    }`}
                  >
                    <div className="font-display text-lg tracking-tight">
                      {p.label}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {p.description}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        {/* Payout preview — only show when we have an amount + a non-lump
            schedule. Mirrors the EVM calculator section but without the
            full timeline component (port-as-needed later). */}
        {amount !== null && amount > 0n && !schedule.isLumpSum && (
          <PayoutPreview
            depositSol={Number(formatSol(net))}
            totalSeconds={schedule.totalSeconds}
            cliffSeconds={schedule.cliffSeconds}
            intervalSeconds={
              selectedPreset === "custom" ? customInterval : 3600
            }
          />
        )}

        {/* Single-unlock preview for lock-until. */}
        {amount !== null &&
          amount > 0n &&
          schedule.isLumpSum &&
          schedule.targetMs !== null && (
            <div className="mt-8 border border-line rounded-md p-5 space-y-3 text-sm">
              <div className="eyebrow">Single unlock</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 tabular">
                <div className="text-muted">Unlocks on</div>
                <div className="text-foreground text-right">
                  {formatTargetDate(schedule.targetMs)}
                </div>
                <div className="text-muted">Locked for</div>
                <div className="text-foreground text-right">
                  {formatDuration(schedule.totalSeconds)}
                </div>
                <div className="text-muted">Amount</div>
                <div className="text-foreground text-right">
                  {formatSol(net)} {DEPOSIT_TOKEN_LABEL}
                </div>
              </div>
            </div>
          )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={
            !wallet.connected ||
            isPending ||
            amount === null ||
            balanceShortfall !== null ||
            schedule.totalSeconds === 0
          }
          className="btn-primary mt-8 sm:mt-10 w-full sm:w-auto"
        >
          {!wallet.connected
            ? "Connect a wallet"
            : status.kind === "building"
              ? "Building transaction…"
              : status.kind === "signing"
                ? "Sign in your wallet…"
                : status.kind === "confirming"
                  ? "Confirming on-chain…"
                  : selectedPreset === "custom" &&
                      customMode === "lockUntil" &&
                      !lockUntilParsed
                    ? "Pick a date at least 1 hour out"
                    : "Lock it in"}
        </button>

        {status.kind === "error" && (
          <p className="mt-4 text-sm text-warning break-words">
            {status.message}
          </p>
        )}

        {IS_DEVNET && (
          <p className="mt-10 text-xs text-faint">
            You&apos;re on devnet. Get devnet SOL from{" "}
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-line hover:decoration-cyan"
            >
              the Solana faucet
            </a>
            .
          </p>
        )}
      </section>
    </main>
  );
}

function PayoutPreview({
  depositSol,
  totalSeconds,
  cliffSeconds,
  intervalSeconds,
}: {
  depositSol: number;
  totalSeconds: number;
  cliffSeconds: number;
  intervalSeconds: number;
}) {
  const { totalIntervals, perInterval, pctPerInterval } = calculatePayoutSchedule(
    depositSol,
    totalSeconds,
    cliffSeconds,
    intervalSeconds,
  );
  if (totalIntervals === 0) return null;

  return (
    <div className="mt-8 border border-line rounded-md p-5 space-y-3 text-sm">
      <div className="eyebrow">Payout preview</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 tabular">
        <div className="text-muted">Reloads</div>
        <div className="text-foreground text-right">
          {totalIntervals} × {formatDuration(intervalSeconds)}
        </div>
        <div className="text-muted">Each reload</div>
        <div className="text-foreground text-right">
          ~{perInterval.toFixed(perInterval >= 1 ? 2 : 4)} SOL (
          {pctPerInterval.toFixed(2)}%)
        </div>
        {cliffSeconds > 0 && (
          <>
            <div className="text-muted">Wait period</div>
            <div className="text-foreground text-right">
              {formatDuration(cliffSeconds)}
            </div>
          </>
        )}
        <div className="text-muted">Total window</div>
        <div className="text-foreground text-right">
          {formatDuration(totalSeconds)}
        </div>
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <CreateForm />
      </Suspense>
    </ErrorBoundary>
  );
}
