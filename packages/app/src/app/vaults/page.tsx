"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { formatUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import Image from "next/image";
import {
  SABLIER_LOCKUP,
  STREAM_START_BLOCK,
  EXPLORER_URL,
} from "@/config/contracts";
import { sablierLockupAbi } from "@/config/abis";
import { ShareCard } from "@/components/ShareCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";

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

function VaultCard({
  vault,
  onClaim,
  claimingId,
}: {
  vault: VaultData;
  onClaim: (streamId: bigint) => void;
  claimingId: bigint | null;
}) {
  const now = Math.floor(Date.now() / 1000);
  const remaining = vault.deposited - vault.withdrawn;
  const progress =
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

  const isClaiming = claimingId === vault.streamId;
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

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500/60 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40">
          <span>
            {formatUnits(vault.withdrawn, USDC_DECIMALS)} claimed
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
        <button
          onClick={() => onClaim(vault.streamId)}
          disabled={vault.claimable === BigInt(0) || isClaiming}
          className="bg-cyan text-black font-semibold rounded-lg px-5 py-2 text-sm hover:bg-cyan/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
        >
          {isClaiming ? "Claiming..." : "Claim"}
        </button>
      </div>

      {/* Share button */}
      <button
        onClick={() => setShowShare(!showShare)}
        className="w-full text-xs text-white/40 hover:text-white/60 transition-colors pt-1"
      >
        {showShare ? "Hide share card" : "Share proof of lock"}
      </button>

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

  // Fetch ERC-721 Transfer events (mint) from Sablier to discover user's streams
  useEffect(() => {
    if (!isConnected || !address || !publicClient) return;

    let cancelled = false;
    setIsLoadingEvents(true);
    setFetchError(null);

    (async () => {
      try {
        const logs = await publicClient.getLogs({
          address: SABLIER_LOCKUP,
          event: {
            type: "event",
            name: "Transfer",
            inputs: [
              { name: "from", type: "address", indexed: true },
              { name: "to", type: "address", indexed: true },
              { name: "tokenId", type: "uint256", indexed: true },
            ],
          },
          args: {
            from: "0x0000000000000000000000000000000000000000",
            to: address,
          },
          fromBlock: STREAM_START_BLOCK,
          toBlock: "latest",
        });

        if (!cancelled) {
          const ids = logs
            .map((log) => log.args.tokenId!)
            .filter(Boolean)
            .reverse(); // newest first
          setStreamIds(ids);
        }
      } catch (err) {
        console.error("Failed to fetch lock events:", err);
        if (!cancelled) {
          setFetchError(
            "Failed to load vaults. The RPC may be down — try again in a moment."
          );
        }
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, publicClient]);

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
  const vaults: VaultData[] = streamIds
    .map((streamId, i) => {
      const streamResult = streamResults?.[i * 2];
      const claimableResult = streamResults?.[i * 2 + 1];

      if (
        streamResult?.status !== "success" ||
        claimableResult?.status !== "success"
      ) {
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
      setClaimingId(null);
      refetchStreams();
      toast("Claim successful!", "success", {
        label: "View on BaseScan",
        href: `${EXPLORER_URL}/tx/${withdrawTxHash}`,
      });
    }
  }, [isWithdrawConfirmed, withdrawTxHash, refetchStreams, toast]);

  // Toast + reset claiming state if tx rejected
  useEffect(() => {
    if (isWithdrawError && claimingId !== null) {
      setClaimingId(null);
      toast("Claim failed or was rejected.", "error");
    }
  }, [isWithdrawError, claimingId, toast]);

  // Not connected
  if (!isConnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-white/50">
          Connect your wallet to view your vaults.
        </p>
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
        <div className="text-4xl">&#x26A0;&#xFE0F;</div>
        <h3 className="text-xl font-semibold">Connection error</h3>
        <p className="text-white/50 text-sm max-w-sm">{fetchError}</p>
        <button
          onClick={() => window.location.reload()}
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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-16">
        <div className="text-4xl">&#x1f4ad;</div>
        <h3 className="text-xl font-semibold">No locks yet</h3>
        <p className="text-white/50 text-sm max-w-sm text-center">
          Lock your gains before you YOLO them away.
        </p>
        <Link
          href="/create"
          className="bg-cyan text-black font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-cyan/90 transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)]"
        >
          Create a Lock
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 space-y-4">
      {vaults.map((vault) => (
        <VaultCard
          key={vault.streamId.toString()}
          vault={vault}
          onClaim={handleClaim}
          claimingId={claimingId}
        />
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
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-white/[0.06] relative z-10 backdrop-blur-xl bg-black/60">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-icon.png"
            alt="RipGuard"
            width={26}
            height={26}
            className="glow-cyan"
          />
          <span className="text-lg font-bold tracking-tight">RipGuard</span>
        </Link>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </header>

      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-2 text-center text-sm text-yellow-400">
        Unaudited beta. Do not deposit what you can&apos;t afford to lose.
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
