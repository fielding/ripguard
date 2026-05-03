"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";

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
  getIntervalOptions,
  parsePositiveDurationParam,
  formatDuration,
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

  // Auto-correct invalid custom combinations (mirrors EVM /create logic).
  useEffect(() => {
    if (customTotal < 3600) {
      setCustomTotal(3600);
    } else if (customCliff > customTotal) {
      setCustomTotal(customCliff);
    }
  }, [customCliff, customTotal]);

  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [solBalance, setSolBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const amount = useMemo(() => parseSolAmount(amountStr), [amountStr]);
  const fee = amount !== null ? computeBrokerFee(amount) : 0n;
  const net = amount !== null ? amount - fee : 0n;

  // Resolve the active schedule (preset or custom). Sablier requires
  // cliff < total strictly, so for the lump-sum case (cliff === total)
  // we add 1 second to total — same workaround the EVM side uses.
  const schedule = useMemo(() => {
    if (selectedPreset !== "custom") {
      const args = presetToSolanaArgs(selectedPreset);
      const preset = PRESETS[selectedPreset];
      return {
        cliffSeconds: args.cliffSeconds,
        totalSeconds: args.totalSeconds,
        label: preset.label,
        isLumpSum: preset.isLumpSum,
      };
    }
    const cliffEqualsTotal = customCliff === customTotal && customCliff > 0;
    return {
      cliffSeconds: customCliff,
      totalSeconds: cliffEqualsTotal ? customTotal + 1 : customTotal,
      label: "Custom Reloads",
      isLumpSum: cliffEqualsTotal,
    };
  }, [selectedPreset, customCliff, customTotal]);

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
      return;
    }
    setBalanceLoading(true);
    try {
      const lamports = await connection.getBalance(wallet.publicKey);
      setSolBalance(BigInt(lamports));
    } catch {
      setSolBalance(null);
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
        `Your wallet has ${balanceShortfall.haveSol} SOL — need ${balanceShortfall.needSol} for the lock plus ~0.005 SOL for fees and rent.`,
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

        {/* Network mismatch nudge — fires when the wallet is connected but
            reports zero balance on the cluster the dApp is talking to.
            Phantom doesn't expose the wallet's selected cluster to the
            dApp, so this heuristic is the best signal we have. */}
        {networkHint && (
          <div className="mt-6 rounded-md border border-warning/40 bg-warning/[0.04] p-4 text-sm">
            <div className="eyebrow text-warning/90 mb-1.5">Heads up</div>
            <p className="text-foreground/90 leading-relaxed">
              Your wallet shows <span className="tabular">0 SOL</span> on{" "}
              {IS_DEVNET ? "Solana devnet" : "Solana mainnet-beta"}.{" "}
              {IS_DEVNET ? (
                <>
                  Make sure your wallet is set to <strong>Devnet</strong>, then
                  fund it from{" "}
                  <a
                    href="https://faucet.solana.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-warning/50 hover:decoration-warning"
                  >
                    the Solana faucet
                  </a>
                  .
                </>
              ) : (
                <>
                  If your wallet is set to a different network (devnet,
                  testnet), switch it to <strong>Mainnet</strong> in the
                  wallet settings before trying to lock.
                </>
              )}
            </p>
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
              <span>
                Balance:{" "}
                {balanceLoading
                  ? "loading…"
                  : solBalance === null
                    ? "—"
                    : `${formatSol(solBalance)} SOL`}
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
          <div className="flex items-end justify-between gap-4 mb-3">
            <legend className="eyebrow">Reload</legend>
            <button
              type="button"
              onClick={() =>
                setSelectedPreset(
                  selectedPreset === "custom" ? "hourly1d" : "custom",
                )
              }
              className="inline-flex items-center min-h-[2.75rem] px-2 -my-2 -mr-2 text-xs text-muted hover:text-cyan transition-colors"
            >
              {selectedPreset === "custom"
                ? "← Back to presets"
                : "Build your own →"}
            </button>
          </div>

          {selectedPreset === "custom" ? (
            <div className="space-y-5 border border-line rounded-md p-5 bg-surface">
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

        <button
          type="button"
          onClick={onSubmit}
          disabled={
            !wallet.connected ||
            isPending ||
            amount === null ||
            balanceShortfall !== null
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
