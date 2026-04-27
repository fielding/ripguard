"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";

import { Header } from "@/components/Header";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import {
  PRESETS,
  USDC_DECIMALS,
  IS_DEVNET,
  computeBrokerFee,
  explorerTx,
  explorerAccount,
  type PresetKey,
} from "@/config/solsab";
import { buildLockTx } from "@/sol/lock";
import { randomSalt } from "@/sol/pdas";
import { presetToSolanaArgs } from "@/sol/preset";
import {
  trackLockApproved,
  trackLockCreated,
  trackContractError,
} from "@/lib/analytics";
import { isUserRejection } from "@/lib/errors";

function parseUsdcAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "000000").slice(0, USDC_DECIMALS);
  try {
    return BigInt(whole) * BigInt(1_000_000) + BigInt(padded);
  } catch {
    return null;
  }
}

function formatUsdc(units: bigint): string {
  const whole = units / BigInt(1_000_000);
  const frac = units % BigInt(1_000_000);
  if (frac === 0n) return whole.toString();
  return `${whole.toString()}.${frac.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

type Status =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "signing" }
  | { kind: "confirming"; signature: string }
  | { kind: "success"; signature: string; streamNftMint: string }
  | { kind: "error"; message: string };

function CreateForm() {
  const params = useSearchParams();
  const presetParam = params.get("preset") as PresetKey | null;

  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();

  const [presetKey, setPresetKey] = useState<PresetKey>(
    presetParam && presetParam in PRESETS ? presetParam : "hourly1d",
  );
  const [amountStr, setAmountStr] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const amount = useMemo(() => parseUsdcAmount(amountStr), [amountStr]);
  const fee = amount !== null ? computeBrokerFee(amount) : 0n;
  const net = amount !== null ? amount - fee : 0n;

  const isPending =
    status.kind === "building" ||
    status.kind === "signing" ||
    status.kind === "confirming";

  const onSubmit = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.toast("Connect a Solana wallet first.", "error");
      return;
    }
    if (amount === null || amount <= 0n) {
      toast.toast("Enter a valid USDC amount.", "error");
      return;
    }

    try {
      setStatus({ kind: "building" });
      trackLockApproved(Number(formatUsdc(amount)));

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
      const presetArgs = presetToSolanaArgs(presetKey);

      const { instructions, pdas, feeAmount, netDepositAmount } =
        await buildLockTx({
          provider,
          signer: wallet.publicKey,
          recipient: wallet.publicKey, // RipGuard's locked-self pattern
          depositAmount: amount,
          cliffSeconds: presetArgs.cliffSeconds,
          totalSeconds: presetArgs.totalSeconds,
          salt,
        });

      // Assemble a legacy Transaction. Solana v0 transactions add lookup
      // tables we don't need yet — keep it simple until we hit the account
      // limit.
      const tx = new Transaction();
      for (const ix of instructions) tx.add(ix);
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      // Use the wallet adapter's sendTransaction rather than manual
      // signTransaction + connection.sendRawTransaction. Phantom (and some
      // other wallets) auto-submit on signTransaction, which causes a
      // "transaction has already been processed" error on the second send.
      // sendTransaction delegates to the wallet's preferred submission path
      // and returns the signature.
      setStatus({ kind: "signing" });
      const signature = await wallet.sendTransaction(tx, connection, {
        preflightCommitment: "confirmed",
      });
      setStatus({ kind: "confirming", signature });

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      trackLockCreated({
        schedule: presetKey,
        amountUsd: Number(formatUsdc(amount)),
        cliffSeconds: presetArgs.cliffSeconds,
        totalSeconds: presetArgs.totalSeconds,
      });
      void netDepositAmount;
      void feeAmount;

      setStatus({
        kind: "success",
        signature,
        streamNftMint: pdas.streamNftMint.toBase58(),
      });
      toast.toast("Locked.", "success");
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
      trackContractError({
        action: "create_with_durations_ll",
        error: e.message,
        contract: "sablier_lockup",
      });
      setStatus({ kind: "error", message: e.message });
      toast.toast(`Lock failed: ${e.message}`, "error");
    }
  }, [amount, connection, presetKey, toast, wallet]);

  if (status.kind === "success") {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <Header />
        <section className="mx-auto max-w-3xl px-5 sm:px-8 py-16">
          <div className="eyebrow mb-6">Locked</div>
          <h1 className="font-display text-4xl tracking-tight">
            Past you just paid future you<span className="text-cyan">.</span>
          </h1>
          <p className="mt-4 text-muted leading-relaxed">
            Your USDC is in the Sablier Lockup program on Solana. Non-cancelable.
            Counting down on-chain regardless of whether RipGuard exists.
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
          <div className="mt-10 flex gap-3">
            <Link href="/vaults" className="btn-primary">
              See vaults
            </Link>
            <Link href="/create" className="btn-secondary">
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
      <section className="mx-auto max-w-3xl px-5 sm:px-8 py-16">
        <div className="eyebrow mb-6">Create a lock</div>
        <h1 className="font-display text-4xl tracking-tight">
          Past you<span className="text-cyan">.</span>
        </h1>
        <p className="mt-4 text-muted">
          Pick a schedule. Sign once. Your future self claims it back on the
          clock.
        </p>

        {!wallet.connected && (
          <div className="mt-8 rounded-md border border-line p-5 text-sm text-muted">
            Connect a Solana wallet from the header to start. Phantom, Solflare,
            and Backpack all work.
          </div>
        )}

        <fieldset className="mt-10" disabled={isPending}>
          <legend className="eyebrow mb-3">Preset</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
              const p = PRESETS[key];
              const active = key === presetKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPresetKey(key)}
                  className={`text-left rounded-md border p-4 transition-colors ${
                    active
                      ? "border-cyan bg-surface"
                      : "border-line hover:border-cyan/40 hover:bg-surface"
                  }`}
                >
                  <div className="font-display text-lg tracking-tight">
                    {p.label}
                  </div>
                  <div className="mt-1 text-xs text-muted">{p.description}</div>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-8" disabled={isPending}>
          <legend className="eyebrow mb-3">Amount (USDC)</legend>
          <input
            type="text"
            inputMode="decimal"
            placeholder="100"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full rounded-md border border-line bg-background px-4 py-3 text-2xl font-display tabular focus:outline-2 focus:outline-cyan focus:outline-offset-2"
            aria-invalid={amountStr.length > 0 && amount === null}
          />
          {amountStr.length > 0 && amount === null && (
            <p className="mt-2 text-sm text-warning">
              Enter a positive number with up to 6 decimal places.
            </p>
          )}
          {amount !== null && (
            <dl className="mt-4 space-y-1 text-sm tabular">
              <div className="flex justify-between text-muted">
                <dt>Fee (0.5%)</dt>
                <dd>{formatUsdc(fee)} USDC</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Locked</dt>
                <dd className="text-foreground">{formatUsdc(net)} USDC</dd>
              </div>
            </dl>
          )}
        </fieldset>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!wallet.connected || isPending || amount === null}
          className="btn-primary mt-10 w-full sm:w-auto"
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
            </a>{" "}
            and devnet USDC from Circle&apos;s faucet to test.
          </p>
        )}
      </section>
    </main>
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
