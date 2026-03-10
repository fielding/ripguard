"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useState, useEffect, useCallback } from "react";
import { formatUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  SABLIER_LOCKUP,
  STREAM_START_BLOCK,
  LOG_CHUNK_SIZE,
  EXPLORER_URL,
} from "@/config/contracts";
import { sablierLockupAbi } from "@/config/abis";
import { ShareCard } from "@/components/ShareCard";
import { ErrorBoundary, CardErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { trackClaim, trackContractError } from "@/lib/analytics";
import { isUserRejection, extractErrorReason } from "@/lib/errors";

const USDC_DECIMALS = 6;

type VaultData = {
  streamId: bigint;
  totalAmount: bigint;
  cliffSeconds: number;
  totalSeconds: number;
  deposited: bigint;
  withdrawn: bigint;
  startTime: number;
  endTime: number;
  cliffTime: number;
  claimable: bigint;
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getScheduleType(cliffSeconds: number, totalSeconds: number): string {
  if (cliffSeconds === totalSeconds && cliffSeconds > 0) return "Lump Sum";
  if (cliffSeconds > 0) return "Cliff + Vest";
  return "Linear Vest";
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function VaultCard({
  vault,
  onClaim,
  claimingId,
}: {
  vault: VaultData;
  onClaim: (streamId: bigint) => void;
  claimingId: bigint | null;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  // Tick countdown — faster when close to unlock
  useEffect(() => {
    if (now >= vault.endTime) return;
    const secsLeft = vault.endTime - now;
    const interval = secsLeft <= 300 ? 1_000 : secsLeft <= 3600 ? 10_000 : 60_000;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), interval);
    return () => clearInterval(id);
  }, [now, vault.endTime]);
  const remaining = vault.deposited - vault.withdrawn;
  const vested = vault.withdrawn + vault.claimable;
  const vestedPct =
    vault.deposited > BigInt(0)
      ? Number((vested * BigInt(10000)) / vault.deposited) / 100
      : 0;
  const claimedPct =
    vault.deposited > BigInt(0)
      ? Number((vault.withdrawn * BigInt(10000)) / vault.deposited) / 100
      : 0;

  const nextUnlock = (() => {
    if (vault.cliffTime > 0 && now < vault.cliffTime) {
      return { label: "Cliff unlocks in", time: vault.cliffTime - now };
    }
    if (now < vault.endTime) {
      return { label: "Fully vested in", time: vault.endTime - now };
    }
    return { label: "Fully vested", time: 0 };
  })();

  const [showShare, setShowShare] = useState(false);

  const nextUnlockLabel =
    nextUnlock.time > 0 ? formatCountdown(nextUnlock.time) : "Now";

  return (
    <div className="card-gradient rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <div className="text-xs text-white/40 font-mono">
            Stream #{vault.streamId.toString()}
          </div>
          <div className="text-sm text-white/60 mt-0.5">
            {getScheduleType(vault.cliffSeconds, vault.totalSeconds)}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-lg font-semibold">
            {formatUnits(vault.deposited, USDC_DECIMALS)} USDC
          </div>
          <div className="text-xs text-white/40">total locked</div>
        </div>
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
        <span>Started {formatDate(vault.startTime)}</span>
        <span>Ends {formatDate(vault.endTime)}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-green-500/30 rounded-full transition-all"
            style={{ width: `${Math.min(vestedPct, 100)}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-green-500/70 rounded-full transition-all"
            style={{ width: `${Math.min(claimedPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40">
          <span>
            {formatUnits(vested, USDC_DECIMALS)} vested
          </span>
          <span>
            {formatUnits(remaining, USDC_DECIMALS)} remaining
          </span>
        </div>
      </div>

      {/* Next unlock countdown */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/50">{nextUnlock.label}</span>
        <span className="font-medium">
          {nextUnlock.time > 0
            ? formatCountdown(nextUnlock.time)
            : "---"}
        </span>
      </div>

      {/* Claimable + button */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div>
          <div className="text-xs text-white/40">Claimable now</div>
          <div className="font-semibold text-green-400">
            {formatUnits(vault.claimable, USDC_DECIMALS)} USDC
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => onClaim(vault.streamId)}
            disabled={vault.claimable === BigInt(0) || claimingId !== null}
            className="bg-cyan text-black font-semibold rounded-lg px-5 py-2.5 min-h-[44px] text-sm hover:bg-cyan/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
          >
            {claimingId === vault.streamId ? "Claiming..." : "Claim"}
          </button>
          {vault.claimable === BigInt(0) && claimingId !== vault.streamId && (
            <span className="text-[10px] text-white/30">
              {now < vault.cliffTime ? "Locked until cliff" : now < vault.endTime ? "Vesting in progress" : "Nothing to claim"}
            </span>
          )}
        </div>
      </div>

      {/* Share + verify links */}
      <div className="flex items-center justify-center gap-4 pt-1">
        <button
          onClick={() => setShowShare(!showShare)}
          className="text-xs text-white/40 hover:text-white/60 transition-colors"
          aria-expanded={showShare}
        >
          {showShare ? "Hide share card" : "Share proof of lock"}
        </button>
        <span className="text-white/15">|</span>
        <a
          href={`${EXPLORER_URL}/nft/${SABLIER_LOCKUP}/${vault.streamId.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/40 hover:text-cyan/70 transition-colors"
        >
          Verify on-chain
        </a>
      </div>

      {showShare && (
        <ShareCard
          streamId={vault.streamId}
          amountLocked={formatUnits(vault.deposited, USDC_DECIMALS)}
          scheduleType={getScheduleType(vault.cliffSeconds, vault.totalSeconds)}
          endDate={new Date(vault.endTime * 1000)}
          nextUnlock={nextUnlockLabel}
          sablierAddress={SABLIER_LOCKUP}
        />
      )}
    </div>
  );
}

function VaultSkeleton() {
  return (
    <div className="card-gradient rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-3 w-16" />
        </div>
        <div className="space-y-2 sm:text-right">
          <div className="skeleton h-5 w-32 sm:ml-auto" />
          <div className="skeleton h-3 w-16 sm:ml-auto" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-3 w-20" />
        </div>
      </div>
      <div className="flex justify-between">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-4 w-16" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="space-y-1">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-5 w-24" />
        </div>
        <div className="skeleton h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

function VaultDashboard() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { toast } = useToast();

  const [streamIds, setStreamIds] = useState<bigint[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<bigint | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  // Fetch ERC-721 Transfer events (mint) from Sablier to discover user's streams.
  // Chunks getLogs into 50k-block ranges to work within public RPC limits.
  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;

    let cancelled = false;
    setIsLoadingEvents(true);
    setFetchError(null);

    (async () => {
      try {
        const CHUNK_SIZE = LOG_CHUNK_SIZE;
        const toBlock = await publicClient.getBlockNumber();
        let from = STREAM_START_BLOCK > toBlock ? toBlock : STREAM_START_BLOCK;
        const allLogs: { args: { tokenId?: bigint } }[] = [];
        const eventDef = {
          type: "event" as const,
          name: "Transfer",
          inputs: [
            { name: "from", type: "address" as const, indexed: true },
            { name: "to", type: "address" as const, indexed: true },
            { name: "tokenId", type: "uint256" as const, indexed: true },
          ],
        };

        while (from <= toBlock) {
          if (cancelled) return;
          const to = from + CHUNK_SIZE - BigInt(1) < toBlock
            ? from + CHUNK_SIZE - BigInt(1)
            : toBlock;
          const chunk = await publicClient.getLogs({
            address: SABLIER_LOCKUP,
            event: eventDef,
            args: {
              from: "0x0000000000000000000000000000000000000000",
              to: address,
            },
            fromBlock: from,
            toBlock: to,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allLogs.push(...(chunk as any[]));
          from = to + BigInt(1);
        }
        const logs = allLogs;

        if (!cancelled) {
          const seen = new Set<string>();
          const ids = logs
            .map((log) => log.args.tokenId)
            .filter((id): id is bigint => {
              if (id == null) return false;
              const key = id.toString();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .reverse(); // newest first
          setStreamIds(ids);
        }
      } catch (err) {
        const errStr = String(err);
        trackContractError({ action: "fetchVaults", error: errStr, contract: "SablierLockup" });
        if (!cancelled) {
          const isRangeError = errStr.toLowerCase().includes("block range") || errStr.toLowerCase().includes("too large") || errStr.toLowerCase().includes("limit exceeded");
          setFetchError(
            isRangeError
              ? "Failed to load vaults — RPC rejected the block range query. Try switching to a different wallet RPC."
              : "Failed to load vaults. The RPC may be down — try again in a moment."
          );
        }
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, publicClient, fetchKey]);

  const retryFetch = useCallback(() => setFetchKey((k) => k + 1), []);

  // Clear vault state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setStreamIds([]);
      setFetchError(null);
      setClaimingId(null);
    }
  }, [isConnected]);

  // Batch read stream data + withdrawable amounts
  const streamContracts = streamIds.flatMap((id) => [
    {
      address: SABLIER_LOCKUP,
      abi: sablierLockupAbi,
      functionName: "getStream" as const,
      args: [id] as const,
    },
    {
      address: SABLIER_LOCKUP,
      abi: sablierLockupAbi,
      functionName: "withdrawableAmountOf" as const,
      args: [id] as const,
    },
  ]);

  const { data: streamResults, refetch: refetchStreams } = useReadContracts({
    contracts: streamContracts,
    query: {
      enabled: streamIds.length > 0,
      refetchInterval: 30_000,
    },
  });

  // Parse vault data
  let failedStreamCount = 0;
  const vaults: VaultData[] = streamIds
    .map((streamId, i) => {
      const streamResult = streamResults?.[i * 2];
      const claimableResult = streamResults?.[i * 2 + 1];

      if (
        streamResult?.status !== "success" ||
        claimableResult?.status !== "success"
      ) {
        if (streamResults) failedStreamCount++;
        return null;
      }

      const stream = streamResult.result as {
        amounts: { deposited: bigint; withdrawn: bigint; refunded: bigint };
        startTime: number;
        endTime: number;
        cliffTime: number;
      };

      const claimable = claimableResult.result as bigint;

      const totalSeconds = stream.endTime - stream.startTime;
      const cliffSeconds =
        stream.cliffTime > 0 ? stream.cliffTime - stream.startTime : 0;

      return {
        streamId,
        totalAmount: stream.amounts.deposited,
        cliffSeconds,
        totalSeconds,
        deposited: stream.amounts.deposited,
        withdrawn: stream.amounts.withdrawn,
        startTime: stream.startTime,
        endTime: stream.endTime,
        cliffTime: stream.cliffTime,
        claimable,
      };
    })
    .filter((v): v is VaultData => v !== null);

  // Claim (withdrawMax)
  const {
    writeContract: writeWithdraw,
    data: withdrawTxHash,
    isError: isWithdrawError,
    error: withdrawError,
  } = useWriteContract();

  const { isSuccess: isWithdrawConfirmed } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });

  const handleClaim = useCallback(
    (streamId: bigint) => {
      if (!address) return;
      setClaimingId(streamId);
      writeWithdraw({
        address: SABLIER_LOCKUP,
        abi: sablierLockupAbi,
        functionName: "withdrawMax",
        args: [streamId, address],
      });
    },
    [address, writeWithdraw]
  );

  // Toast + refresh after successful claim
  useEffect(() => {
    if (isWithdrawConfirmed && withdrawTxHash) {
      if (claimingId !== null) trackClaim(claimingId.toString());
      setClaimingId(null);
      refetchStreams();
      toast("Claim successful!", "success", {
        label: "View on BaseScan",
        href: `${EXPLORER_URL}/tx/${withdrawTxHash}`,
      });
    }
  }, [isWithdrawConfirmed, withdrawTxHash, claimingId, refetchStreams, toast]);

  // Toast + reset claiming state if tx rejected or failed
  useEffect(() => {
    if (isWithdrawError && claimingId !== null) {
      trackContractError({ action: "claim", error: isUserRejection(withdrawError) ? "User rejected" : "Transaction failed", contract: "SablierLockup" });
      setClaimingId(null);
      refetchStreams();
      if (isUserRejection(withdrawError)) {
        toast("You rejected the claim request.", "error");
      } else {
        toast(extractErrorReason(withdrawError), "error");
      }
    }
  }, [isWithdrawError, withdrawError, claimingId, refetchStreams, toast]);

  // Not connected
  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-20 px-6">
        <div className="relative">
          <svg aria-hidden="true" className="w-16 h-16 text-cyan/30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2L4 8v8c0 7.73 5.12 14.95 12 16.73C22.88 30.95 28 23.73 28 16V8L16 2Z" stroke="currentColor" strokeWidth="1.5" fill="rgba(0,229,255,0.04)" />
            <rect x="12" y="12" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="rgba(0,229,255,0.03)" />
            <path d="M13.5 12V10a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 blur-2xl bg-cyan/[0.06] rounded-full" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-white/80">Connect to view your vaults</h3>
          <p className="text-sm text-white/40 max-w-xs">
            See your locked USDC, track vesting progress, and claim when ready.
          </p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  // Loading with skeletons
  if (isLoadingEvents) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 space-y-4">
        <VaultSkeleton />
        <VaultSkeleton />
        <VaultSkeleton />
      </div>
    );
  }

  // RPC / fetch error
  if (fetchError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-full border border-yellow-500/30 flex items-center justify-center">
          <svg aria-hidden="true" className="w-6 h-6 text-yellow-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold">Connection error</h3>
        <p className="text-white/50 text-sm max-w-sm">{fetchError}</p>
        <button
          onClick={retryFetch}
          className="border border-white/20 rounded-lg px-5 py-2 text-sm hover:bg-white/5 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (streamIds.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-20 px-6">
        <div className="relative">
          <svg aria-hidden="true" className="w-14 h-14 text-white/20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2L4 8v8c0 7.73 5.12 14.95 12 16.73C22.88 30.95 28 23.73 28 16V8L16 2Z" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.02)" />
            <rect x="12" y="12" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="rgba(255,255,255,0.02)" />
            <path d="M13.5 12V10a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 blur-2xl bg-white/[0.03] rounded-full" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">No locks yet</h3>
          <p className="text-white/40 text-sm max-w-xs">
            Lock your gains before you YOLO them away.
          </p>
        </div>
        <Link
          href="/create"
          className="bg-cyan text-black font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-cyan/90 transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
        >
          Create a Lock
        </Link>
      </div>
    );
  }

  // Aggregate stats (only compute when we have multiple vaults)
  const totals = vaults.length >= 2
    ? vaults.reduce(
        (acc, v) => ({
          locked: acc.locked + v.deposited,
          claimable: acc.claimable + v.claimable,
          claimed: acc.claimed + v.withdrawn,
        }),
        { locked: BigInt(0), claimable: BigInt(0), claimed: BigInt(0) }
      )
    : null;

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 space-y-4">
      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
          <div className="card-gradient rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-white/40">Total Locked</div>
            <div className="text-lg font-semibold mt-0.5">
              {formatUnits(totals.locked, USDC_DECIMALS)} <span className="text-sm text-white/40">USDC</span>
            </div>
          </div>
          <div className="card-gradient rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-white/40">Claimable</div>
            <div className="text-lg font-semibold text-green-400 mt-0.5">
              {formatUnits(totals.claimable, USDC_DECIMALS)} <span className="text-sm text-green-400/50">USDC</span>
            </div>
          </div>
          <div className="card-gradient rounded-xl px-4 py-3 text-center">
            <div className="text-xs text-white/40">Claimed</div>
            <div className="text-lg font-semibold mt-0.5">
              {formatUnits(totals.claimed, USDC_DECIMALS)} <span className="text-sm text-white/40">USDC</span>
            </div>
          </div>
        </div>
      )}
      {failedStreamCount > 0 && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400">
          <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            {failedStreamCount} {failedStreamCount === 1 ? "vault" : "vaults"} failed to load.{" "}
            <button onClick={retryFetch} className="underline hover:text-yellow-300 transition-colors">
              Retry
            </button>
          </span>
        </div>
      )}
      {vaults.map((vault) => (
        <CardErrorBoundary key={vault.streamId.toString()} label={`Stream #${vault.streamId.toString()}`}>
          <VaultCard
            vault={vault}
            onClaim={handleClaim}
            claimingId={claimingId}
          />
        </CardErrorBoundary>
      ))}
      <div className="text-center pt-4">
        <Link
          href="/create"
          className="text-sm text-white/40 hover:text-cyan transition-colors underline decoration-white/15 hover:decoration-cyan/40"
        >
          Create another lock
        </Link>
      </div>
    </div>
  );
}

export default function Vaults() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Header />

      <div className="bg-cyan/[0.06] border-b border-cyan/10 px-6 py-2 text-center text-sm text-cyan/60">
        Powered by Sablier v2.0 audited contracts &middot; Non-custodial &middot; Immutable locks
      </div>

      <main className="flex-1 flex flex-col">
        <div className="px-6 pt-8 pb-4 text-center">
          <h2 className="text-2xl font-bold">Your Vaults</h2>
        </div>
        <ErrorBoundary fallbackTitle="Failed to load vaults">
          <VaultDashboard />
        </ErrorBoundary>
      </main>
    </div>
  );
}
