"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Transaction, type PublicKey } from "@solana/web3.js";

import { Header } from "@/components/Header";
import { ErrorBoundary, CardErrorBoundary } from "@/components/ErrorBoundary";
import { MobileWalletFallback } from "@/components/MobileWalletFallback";
import { useToast } from "@/components/Toast";
import {
  SOL_DECIMALS,
  DEPOSIT_TOKEN_LABEL,
  explorerAccount,
  explorerTx,
} from "@/config/solsab";
import {
  getStreamsForSender,
  type DiscoveredStream,
} from "@/sol/vault-discovery";
import { buildWithdrawMaxTx } from "@/sol/withdraw";
import {
  streamStatus,
  withdrawableAmount,
  streamProgress,
  secondsUntilNext,
} from "@/sol/vault-math";
import { trackClaim, trackContractError } from "@/lib/analytics";
import { isUserRejection } from "@/lib/errors";

// Same display strategy as /create: 9 decimals on chain, render up to 4
// fractional digits, trim trailing zeros.
const LAMPORTS_PER_SOL = BigInt(1_000_000_000);

function formatSol(units: bigint): string {
  const whole = units / LAMPORTS_PER_SOL;
  const frac = units % LAMPORTS_PER_SOL;
  if (frac === 0n) return whole.toString();
  const padded = frac.toString().padStart(SOL_DECIMALS, "0");
  const trimmed = padded.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
}

function formatCountdown(seconds: bigint | null): string {
  if (seconds === null) return "—";
  if (seconds <= 0n) return "now";
  const s = Number(seconds);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function shortKey(key: PublicKey | string, n = 4): string {
  const s = typeof key === "string" ? key : key.toBase58();
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

interface VaultCardProps {
  stream: DiscoveredStream;
  now: bigint;
  onClaim: (stream: DiscoveredStream) => void;
  claiming: boolean;
}

function VaultCard({ stream, now, onClaim, claiming }: VaultCardProps) {
  const { snapshot } = stream;
  const status = streamStatus(snapshot, now);
  const claimable = withdrawableAmount(snapshot, now);
  const progress = streamProgress(snapshot, now);
  const next = secondsUntilNext(snapshot, now);

  const canClaim = claimable > 0n && !snapshot.isDepleted;

  return (
    <article className="rounded-md border border-line p-6 bg-background hover:border-cyan/40 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">
            <span
              className={
                status === "Streaming"
                  ? "text-cyan"
                  : status === "Settled"
                    ? "text-cyan"
                    : status === "Pending"
                      ? "text-muted"
                      : "text-faint"
              }
            >
              {status}
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl tracking-tight tabular">
            {formatSol(snapshot.deposited)} {DEPOSIT_TOKEN_LABEL}
          </h2>
          <p className="mt-1 text-xs text-faint font-mono">
            <a
              href={explorerAccount(stream.streamNftMint)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan underline decoration-line"
              title={stream.streamNftMint.toBase58()}
            >
              stream {shortKey(stream.streamNftMint)}
            </a>
          </p>
        </div>
        <div className="text-right">
          <div className="eyebrow text-faint">Claimable</div>
          <div className="font-display text-xl tabular text-cyan">
            {formatSol(claimable)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="h-1 rounded-full bg-line overflow-hidden">
          <div
            className="h-full bg-cyan transition-all duration-1000 ease-linear"
            style={{ width: `${(progress * 100).toFixed(2)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-faint tabular">
          <span>{(progress * 100).toFixed(1)}% unlocked</span>
          {next !== null && (
            <span>
              {status === "Pending" ? "starts in" : "ends in"} {formatCountdown(next)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onClaim(stream)}
          disabled={!canClaim || claiming}
          className="btn-primary !min-h-[2.5rem] !py-2 !px-4 !text-sm"
        >
          {claiming ? "Claiming…" : canClaim ? "Claim" : "Nothing to claim"}
        </button>
        <span className="text-xs text-faint tabular">
          Withdrawn: {formatSol(snapshot.withdrawn)} {DEPOSIT_TOKEN_LABEL}
        </span>
      </div>
    </article>
  );
}

function VaultsBody() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();

  const [streams, setStreams] = useState<DiscoveredStream[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));
  const [claimingMint, setClaimingMint] = useState<string | null>(null);

  // Tick the clock every second so countdowns feel live.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(BigInt(Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
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
    return new AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const loadStreams = useCallback(async () => {
    if (!provider || !wallet.publicKey) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getStreamsForSender(provider, wallet.publicKey);
      // Newest first by start time
      result.sort((a, b) =>
        a.snapshot.startTime > b.snapshot.startTime
          ? -1
          : a.snapshot.startTime < b.snapshot.startTime
            ? 1
            : 0,
      );
      setStreams(result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [provider, wallet.publicKey]);

  // Auto-load on connect.
  useEffect(() => {
    if (wallet.connected) loadStreams();
    else setStreams(null);
  }, [wallet.connected, loadStreams]);

  const onClaim = useCallback(
    async (stream: DiscoveredStream) => {
      if (!provider || !wallet.publicKey) return;
      const mintStr = stream.streamNftMint.toBase58();
      setClaimingMint(mintStr);
      try {
        const { instructions } = await buildWithdrawMaxTx({
          provider,
          signer: wallet.publicKey,
          streamNftMint: stream.streamNftMint,
          depositedTokenMint: stream.depositedTokenMint,
        });

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
        const signed = await wallet.signTransaction(tx);
        const signature = await connection.sendRawTransaction(
          signed.serialize(),
          {
            maxRetries: 5,
            skipPreflight: false,
            preflightCommitment: "confirmed",
          },
        );
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );

        trackClaim(mintStr);
        toast.toast("Claimed.", "success", {
          label: "View tx",
          href: explorerTx(signature),
        });
        // Refresh after claim.
        await loadStreams();
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (isUserRejection(e)) return;
        trackContractError({
          action: "withdraw_max",
          error: e.message,
          contract: "sablier_lockup",
        });
        toast.toast(`Claim failed: ${e.message}`, "error");
      } finally {
        setClaimingMint(null);
      }
    },
    [connection, loadStreams, provider, toast, wallet],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />
      <section className="mx-auto max-w-4xl px-5 sm:px-8 py-16">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="eyebrow">Your vaults</div>
            <h1 className="mt-2 font-display text-4xl tracking-tight">
              Claim what&apos;s unlocked<span className="text-cyan">.</span>
            </h1>
          </div>
          {wallet.connected && (
            <button
              type="button"
              onClick={loadStreams}
              disabled={loading}
              className="btn-secondary !min-h-[2.5rem] !py-2 !px-4 !text-sm shrink-0"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          )}
        </div>

        {!wallet.connected && (
          <>
            <div className="mt-10 rounded-md border border-line p-6 text-muted">
              Connect a Solana wallet from the header to see your locks.
            </div>
            <MobileWalletFallback />
          </>
        )}

        {wallet.connected && loading && streams === null && (
          <div className="mt-10 text-muted">Scanning your streams…</div>
        )}

        {wallet.connected && loadError && (
          <div className="mt-10 rounded-md border border-warning/40 p-6 text-warning text-sm">
            Couldn&apos;t load vaults: {loadError}
          </div>
        )}

        {wallet.connected && streams !== null && streams.length === 0 && (
          <div className="mt-10 rounded-md border border-line p-6 text-muted">
            No locks yet.{" "}
            <Link href="/create" className="text-cyan underline decoration-cyan/40">
              Create one
            </Link>
            .
          </div>
        )}

        {streams !== null && streams.length > 0 && (
          <div className="mt-10 grid gap-4">
            {streams.map((stream) => (
              <CardErrorBoundary key={stream.streamData.toBase58()}>
                <VaultCard
                  stream={stream}
                  now={now}
                  onClaim={onClaim}
                  claiming={
                    claimingMint === stream.streamNftMint.toBase58()
                  }
                />
              </CardErrorBoundary>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function VaultsPage() {
  return (
    <ErrorBoundary>
      <VaultsBody />
    </ErrorBoundary>
  );
}
