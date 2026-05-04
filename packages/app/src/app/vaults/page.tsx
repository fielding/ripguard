"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useState, useEffect, useCallback } from "react";
import { formatUnits, parseAbiItem, type Address, type PublicClient } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { CHAINS, getChainConfig, isSupportedDeploymentChain, DEFAULT_CHAIN_ID, type ChainConfig } from "@/config/chains";
import { IS_TESTNET } from "@/config/contracts";
import { sablierLockupAbi } from "@/config/abis";
import { WrongChainPanel } from "@/components/WrongChainPanel";
import { ShareCard } from "@/components/ShareCard";
import { ErrorBoundary, CardErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { trackClaim, trackContractError } from "@/lib/analytics";
import { isUserRejection, extractErrorReason } from "@/lib/errors";

// Sablier Envio indexer — single endpoint, no API key, supports all chains.
// Per-chain selection happens via the `chainId` filter in the GraphQL query.
const SABLIER_SUBGRAPH = "https://indexer.hyperindex.xyz/53b7e25/v1/graphql";

type SubgraphStream = {
  tokenId: string;
  depositAmount: string;
  withdrawnAmount: string;
  startTime: string;
  endTime: string;
  cliffTime: string | null;
};

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
  if (cliffSeconds === totalSeconds && cliffSeconds > 0) return "One Drop";
  if (cliffSeconds > 0) return "Wait, then reloads";
  return "Steady reloads";
}

// Prefer the preset label the user picked on /create (stored at lock time).
// Falls back to the generic schedule-type label when no preset is remembered.
// chainId is part of the key because Sablier stream IDs reset per chain —
// stream #5 on Arbitrum and stream #5 on Base are different vaults.
function getLockLabel(
  streamId: bigint,
  chainId: number,
  cliffSeconds: number,
  totalSeconds: number,
): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(
        `ripguard:lock:${chainId}:${streamId.toString()}`,
      );
      if (stored) return stored;
    } catch {
      // localStorage unavailable, fall through
    }
  }
  return getScheduleType(cliffSeconds, totalSeconds);
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
  index,
  chainId,
  usdcDecimals,
  sablierAddress,
  explorerUrl,
}: {
  vault: VaultData;
  onClaim: (streamId: bigint) => void;
  claimingId: bigint | null;
  index: number;
  chainId: number;
  usdcDecimals: number;
  sablierAddress: Address;
  explorerUrl: string;
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
      return { label: "Reloads start in", time: vault.cliffTime - now };
    }
    if (now < vault.endTime) {
      return { label: "Fully reloaded in", time: vault.endTime - now };
    }
    return { label: "Fully reloaded", time: 0 };
  })();

  const [showShare, setShowShare] = useState(false);

  const nextUnlockLabel =
    nextUnlock.time > 0 ? formatCountdown(nextUnlock.time) : "Now";

  const canClaim = vault.claimable > BigInt(0);
  const isClaimingThis = claimingId === vault.streamId;
  const claimStatus =
    now < vault.cliffTime
      ? "Waiting"
      : now < vault.endTime
        ? "Reloading"
        : "All claimed";

  return (
    <div
      className="bg-background p-6 sm:p-7 space-y-6 animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 60, 320)}ms` }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1.5">
          <div className="eyebrow text-cyan/70 tabular">
            Lock #{vault.streamId.toString()}
          </div>
          <div className="font-display text-xl tracking-tight">
            {getLockLabel(vault.streamId, chainId, vault.cliffSeconds, vault.totalSeconds)}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="font-display text-2xl tabular tracking-tight">
            {formatUnits(vault.deposited, usdcDecimals)}
            <span className="text-sm text-muted font-sans ml-1.5 tracking-wider">USDC</span>
          </div>
          <div className="eyebrow mt-1">Total locked</div>
        </div>
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-faint tabular">
        <span>Started {formatDate(vault.startTime)}</span>
        <span>Ends {formatDate(vault.endTime)}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div
          className={`relative h-1.5 bg-surface rounded-full overflow-hidden ${canClaim ? "animate-progress-glow" : ""}`}
          role="progressbar"
          aria-valuenow={Math.round(vestedPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(vestedPct)}% vested`}
        >
          <div
            className="absolute inset-y-0 left-0 bg-cyan/30 rounded-full transition-[width]"
            style={{ width: `${Math.min(vestedPct, 100)}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-cyan rounded-full transition-[width]"
            style={{ width: `${Math.min(claimedPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs tabular">
          <span className="text-muted">
            {formatUnits(vested, usdcDecimals)} unlocked
          </span>
          <span className="text-faint">
            {formatUnits(remaining, usdcDecimals)} remaining
          </span>
        </div>
      </div>

      {/* Next unlock countdown */}
      <div className="flex items-center justify-between text-sm tabular">
        <span className="text-muted">{nextUnlock.label}</span>
        <span className="text-foreground font-semibold">
          {nextUnlock.time > 0 ? formatCountdown(nextUnlock.time) : "---"}
        </span>
      </div>

      {/* Claimable + button */}
      <div className="flex items-center justify-between gap-4 pt-5 border-t border-line">
        <div>
          <div className="eyebrow mb-1.5">Claimable now</div>
          <div
            className={`font-display text-3xl text-cyan tabular tracking-tight ${canClaim ? "animate-claim-pulse" : ""}`}
          >
            {formatUnits(vault.claimable, usdcDecimals)}
            <span className="text-sm text-cyan/60 font-sans ml-1.5 tracking-wider">USDC</span>
          </div>
          {!canClaim && !isClaimingThis && (
            <span className="text-[11px] text-faint mt-1 block tabular">
              {claimStatus}
            </span>
          )}
        </div>
        <button
          onClick={() => onClaim(vault.streamId)}
          disabled={!canClaim || claimingId !== null}
          className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          {isClaimingThis ? "Claiming…" : "Claim reload"}
        </button>
      </div>

      {/* Share + verify links */}
      <div className="flex items-center gap-5 text-xs pt-1">
        <button
          onClick={() => setShowShare(!showShare)}
          className="text-muted hover:text-cyan transition-colors"
          aria-expanded={showShare}
        >
          {showShare ? "Hide share card" : "Share proof of lock"}
        </button>
        <span className="text-faint/50">·</span>
        <a
          href={`${explorerUrl}/nft/${sablierAddress}/${vault.streamId.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-cyan transition-colors"
        >
          Verify on-chain →
        </a>
      </div>

      {showShare && (
        <ShareCard
          streamId={vault.streamId}
          amountLocked={formatUnits(vault.deposited, usdcDecimals)}
          scheduleType={getLockLabel(vault.streamId, chainId, vault.cliffSeconds, vault.totalSeconds)}
          endDate={new Date(vault.endTime * 1000)}
          nextUnlock={nextUnlockLabel}
          sablierAddress={sablierAddress}
        />
      )}
    </div>
  );
}

function VaultSkeleton() {
  return (
    <div className="bg-background p-6 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-6 w-32" />
        </div>
        <div className="space-y-2 sm:text-right">
          <div className="skeleton h-8 w-40 sm:ml-auto" />
          <div className="skeleton h-3 w-20 sm:ml-auto" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-3 w-24" />
        </div>
      </div>
      <div className="flex justify-between">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-4 w-16" />
      </div>
      <div className="flex items-center justify-between pt-5 border-t border-line">
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-8 w-32" />
        </div>
        <div className="skeleton h-12 w-32 rounded-lg" />
      </div>
    </div>
  );
}

// ERC-721 Transfer event for stream discovery fallback
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

async function fetchFromSubgraph(
  address: Address,
  chainId: number,
  sablierAddress: Address
): Promise<SubgraphStream[]> {
  const query = `{
    LockupStream(
      where: {
        recipient: { _eq: "${address.toLowerCase()}" }
        chainId: { _eq: "${chainId.toString()}" }
        contract: { _eq: "${sablierAddress.toLowerCase()}" }
      }
      order_by: { startTime: desc }
    ) {
      tokenId
      depositAmount
      withdrawnAmount
      startTime
      endTime
      cliffTime
    }
  }`;

  const res = await fetch(SABLIER_SUBGRAPH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Subgraph returned ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "Subgraph query failed");
  return json.data?.LockupStream ?? [];
}

async function fetchFromChain(
  publicClient: PublicClient,
  address: Address,
  chainConfig: ChainConfig,
): Promise<SubgraphStream[]> {
  const { sablierLockup, streamStartBlock, logChunkSize } = chainConfig;
  const toBlock = await publicClient.getBlockNumber();
  const allTokenIds: bigint[] = [];
  let from = streamStartBlock;

  while (from <= toBlock) {
    const to = from + logChunkSize > toBlock ? toBlock : from + logChunkSize;
    const chunk = await publicClient.getLogs({
      address: sablierLockup,
      event: transferEvent,
      args: { from: "0x0000000000000000000000000000000000000000", to: address },
      fromBlock: from,
      toBlock: to,
    });
    for (const log of chunk) {
      if (log.args.tokenId != null) allTokenIds.push(log.args.tokenId);
    }
    from = to + BigInt(1);
  }

  if (allTokenIds.length === 0) return [];

  const ids = allTokenIds;

  // Multicall: 5 reads per stream (startTime, endTime, cliffTime, deposited, withdrawn)
  const calls = ids.flatMap((id) => [
    { address: sablierLockup, abi: sablierLockupAbi, functionName: "getStartTime" as const, args: [id] as const },
    { address: sablierLockup, abi: sablierLockupAbi, functionName: "getEndTime" as const, args: [id] as const },
    { address: sablierLockup, abi: sablierLockupAbi, functionName: "getCliffTime" as const, args: [id] as const },
    { address: sablierLockup, abi: sablierLockupAbi, functionName: "getDepositedAmount" as const, args: [id] as const },
    { address: sablierLockup, abi: sablierLockupAbi, functionName: "getWithdrawnAmount" as const, args: [id] as const },
  ]);

  const results = await publicClient.multicall({ contracts: calls });

  return ids.map((id, i) => {
    const base = i * 5;
    const startTime = results[base].result as number;
    const endTime = results[base + 1].result as number;
    const cliffTime = results[base + 2].result as number;
    const deposited = results[base + 3].result as bigint;
    const withdrawn = results[base + 4].result as bigint;

    return {
      tokenId: id.toString(),
      depositAmount: deposited.toString(),
      withdrawnAmount: withdrawn.toString(),
      startTime: startTime.toString(),
      endTime: endTime.toString(),
      cliffTime: cliffTime > 0 ? cliffTime.toString() : null,
    };
  });
}

function VaultDashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  // Defensive lookup: unsupported chains fall back to the deployment's
  // default chain so the page renders. The wrong-chain panel below blocks
  // any tx on the unsupported chain.
  const chainConfig = getChainConfig(
    isSupportedDeploymentChain(chainId, IS_TESTNET) ? chainId : DEFAULT_CHAIN_ID,
  );
  const { sablierLockup, usdcDecimals, explorerUrl, explorerName } = chainConfig;
  const publicClient = usePublicClient();
  const { toast } = useToast();

  const [subgraphStreams, setSubgraphStreams] = useState<SubgraphStream[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<bigint | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [fetchSource, setFetchSource] = useState<"subgraph" | "onchain" | null>(null);
  // Other-chain probe — when the current chain returns 0 streams, fan
  // out to the rest of the deployment's chains so we can tell users
  // exactly where their vaults actually live. The "vault vanished"
  // support hits we've seen are almost all wallet-on-wrong-chain.
  const [otherChainStreams, setOtherChainStreams] = useState<
    Array<{ chainId: number; chainName: string; count: number }>
  >([]);

  // Fetch streams: subgraph first, on-chain fallback
  useEffect(() => {
    if (!isConnected || !address) return;

    let cancelled = false;
    setIsLoadingEvents(true);
    setFetchError(null);
    setFetchSource(null);

    (async () => {
      try {
        const streams = await fetchFromSubgraph(address, chainId, sablierLockup);
        if (!cancelled) {
          setSubgraphStreams(streams);
          setFetchSource("subgraph");
        }
      } catch (subgraphErr) {
        // Subgraph unavailable — fall back to on-chain
        trackContractError({ action: "fetchVaults", error: String(subgraphErr), contract: "SablierLockup" });

        if (!publicClient) {
          if (!cancelled) setFetchError("Wallet not connected. Please reconnect and try again.");
          return;
        }

        try {
          const streams = await fetchFromChain(publicClient, address, chainConfig);
          if (!cancelled) {
            setSubgraphStreams(streams);
            setFetchSource("onchain");
          }
        } catch (chainErr) {
          trackContractError({ action: "fetchVaults:onchain", error: String(chainErr), contract: "SablierLockup" });
          if (!cancelled) {
            setFetchError("Failed to load vaults. Try again in a moment.");
          }
        }
      } finally {
        if (!cancelled) setIsLoadingEvents(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address, isConnected, publicClient, fetchKey, chainId, sablierLockup, chainConfig]);

  const retryFetch = useCallback(() => setFetchKey((k) => k + 1), []);

  // Cross-chain probe: when the current chain comes back empty, hit
  // every other deployment chain's subgraph in parallel and surface
  // the counts. Cheap (one subgraph query per chain), and tells users
  // exactly where their vaults live when the wallet is on the wrong
  // chain. Subgraph-only by design — chain-scan fallback would be
  // catastrophic to fan out across 6 chains on mobile.
  useEffect(() => {
    if (
      !isConnected ||
      !address ||
      isLoadingEvents ||
      fetchError ||
      subgraphStreams.length > 0
    ) {
      setOtherChainStreams([]);
      return;
    }
    let cancelled = false;
    const otherChains = Object.values(CHAINS).filter(
      (c) => c.isTestnet === IS_TESTNET && c.chainId !== chainId,
    );
    Promise.all(
      otherChains.map(async (c) => {
        try {
          const streams = await fetchFromSubgraph(
            address,
            c.chainId,
            c.sablierLockup,
          );
          return { chainId: c.chainId, chainName: c.name, count: streams.length };
        } catch {
          return { chainId: c.chainId, chainName: c.name, count: 0 };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setOtherChainStreams(results.filter((r) => r.count > 0));
    });
    return () => {
      cancelled = true;
    };
  }, [
    address,
    chainId,
    fetchError,
    isConnected,
    isLoadingEvents,
    subgraphStreams.length,
  ]);

  // Clear vault state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setSubgraphStreams([]);
      setFetchError(null);
      setClaimingId(null);
      setOtherChainStreams([]);
    }
  }, [isConnected]);

  // Only need on-chain call for live claimable amount (1 call per stream)
  const streamIds = subgraphStreams.map((s) => BigInt(s.tokenId));
  const claimableContracts = streamIds.map((id) => ({
    address: sablierLockup,
    abi: sablierLockupAbi,
    functionName: "withdrawableAmountOf" as const,
    args: [id] as const,
  }));

  const { data: claimableResults, refetch: refetchStreams } = useReadContracts({
    contracts: claimableContracts,
    query: {
      enabled: streamIds.length > 0,
      refetchInterval: 30_000,
    },
  });

  // Build vault data from subgraph + on-chain claimable
  let failedStreamCount = 0;
  const vaults: VaultData[] = subgraphStreams
    .map((stream, i) => {
      const startTime = Number(stream.startTime);
      const endTime = Number(stream.endTime);
      const cliffTime = stream.cliffTime ? Number(stream.cliffTime) : 0;
      const deposited = BigInt(stream.depositAmount);
      const withdrawn = BigInt(stream.withdrawnAmount);

      const claimableResult = claimableResults?.[i];
      const claimable = claimableResult?.status === "success"
        ? (claimableResult.result as bigint)
        : BigInt(0);

      if (claimableResults && claimableResult?.status !== "success") {
        failedStreamCount++;
      }

      const totalSeconds = endTime - startTime;
      const cliffSeconds = cliffTime > 0 ? cliffTime - startTime : 0;

      return {
        streamId: BigInt(stream.tokenId),
        totalAmount: deposited,
        cliffSeconds,
        totalSeconds,
        deposited,
        withdrawn,
        startTime,
        endTime,
        cliffTime,
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
    reset: resetWithdrawWrite,
  } = useWriteContract();

  const { isSuccess: isWithdrawConfirmed } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });

  const handleClaim = useCallback(
    (streamId: bigint) => {
      if (!address) return;
      // Clear stale success/error state from a previous claim so the
      // post-confirm effect doesn't fire against leftover data when the
      // user claims a second stream in the same session.
      resetWithdrawWrite();
      setClaimingId(streamId);
      writeWithdraw({
        address: sablierLockup,
        abi: sablierLockupAbi,
        functionName: "withdrawMax",
        args: [streamId, address],
      });
    },
    [address, writeWithdraw, resetWithdrawWrite, sablierLockup]
  );

  // Toast + refresh after successful claim. We guard on `claimingId !== null`
  // so this effect can't re-fire after the body sets claimingId back to
  // null (which would otherwise double-toast because claimingId is in deps).
  useEffect(() => {
    if (isWithdrawConfirmed && withdrawTxHash && claimingId !== null) {
      trackClaim(claimingId.toString());
      setClaimingId(null);
      refetchStreams();
      toast("Claim successful!", "success", {
        label: `View on ${explorerName}`,
        href: `${explorerUrl}/tx/${withdrawTxHash}`,
      });
    }
  }, [isWithdrawConfirmed, withdrawTxHash, claimingId, refetchStreams, toast, explorerUrl, explorerName]);

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
      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-20 px-6">
        <div className="relative">
          <div className="absolute inset-0 blur-[40px] bg-cyan/[0.08] rounded-full" />
          <svg aria-hidden="true" className="relative w-16 h-16 text-cyan" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2L4 8v8c0 7.73 5.12 14.95 12 16.73C22.88 30.95 28 23.73 28 16V8L16 2Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.06" />
            <rect x="12" y="12" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.04" />
            <path d="M13.5 12V10a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center space-y-3 max-w-md">
          <div className="eyebrow text-cyan/70">Wallet required</div>
          <h3 className="font-display text-3xl tracking-tight">
            Connect to see your vaults.
          </h3>
          <p className="text-sm text-muted leading-relaxed">
            Your locks live on-chain. Plug in the wallet that signed them to
            track reloads and claim.
          </p>
        </div>
        <ConnectButton />
      </div>
    );
  }

  // Loading with skeletons
  if (isLoadingEvents) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 pb-24 space-y-px bg-line border border-line rounded-lg overflow-hidden">
        <VaultSkeleton />
        <VaultSkeleton />
        <VaultSkeleton />
      </div>
    );
  }

  // RPC / fetch error
  if (fetchError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-20 px-6 text-center">
        <div className="eyebrow text-warning/80">Connection error</div>
        <h3 className="font-display text-3xl tracking-tight max-w-md">
          Couldn&apos;t reach the chain.
        </h3>
        <p className="text-muted text-sm max-w-sm leading-relaxed">
          {fetchError} Your vaults are unaffected. They live in Sablier.
        </p>
        <button onClick={retryFetch} className="btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  // Empty state. Two flavors:
  //   (1) no vaults anywhere on this account (welcome / first-time user)
  //   (2) no vaults on the *current* chain but the wallet has vaults on
  //       a different supported chain — by far the most common cause of
  //       "vault vanished" support hits, so we surface a one-click
  //       switch instead of a generic empty state.
  if (streamIds.length === 0) {
    const truncated = address
      ? `${address.slice(0, 6)}…${address.slice(-4)}`
      : "your wallet";
    if (otherChainStreams.length > 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 py-20 px-6">
          <div className="text-center space-y-3 max-w-lg">
            <div className="eyebrow text-warning/90">Wrong chain?</div>
            <h3 className="font-display text-3xl tracking-tight">
              No vaults on{" "}
              <span className="text-cyan">{chainConfig.name}</span> for
              this wallet.
            </h3>
            <p className="text-muted text-sm leading-relaxed mx-auto max-w-md">
              {truncated} has locks on another chain. Switch your wallet
              to one of these to see them.
            </p>
          </div>
          <ul className="w-full max-w-md space-y-2">
            {otherChainStreams.map((c) => (
              <li
                key={c.chainId}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-background px-4 py-3"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-cyan tabular text-2xl leading-none">
                    {c.count}
                  </span>
                  <span className="text-sm text-foreground">
                    on {c.chainName}
                  </span>
                </div>
                <button
                  onClick={() => switchChain({ chainId: c.chainId })}
                  className="btn-secondary !min-h-[2.5rem] !py-2 !px-4 !text-sm"
                >
                  Switch
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={retryFetch}
            className="text-xs text-muted hover:text-cyan underline transition-colors"
          >
            Or refresh this chain
          </button>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-20 px-6">
        <div className="relative">
          <div className="absolute inset-0 blur-[40px] bg-cyan/[0.04] rounded-full" />
          <svg aria-hidden="true" className="relative w-14 h-14 text-subtle" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 2L4 8v8c0 7.73 5.12 14.95 12 16.73C22.88 30.95 28 23.73 28 16V8L16 2Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.03" />
            <rect x="12" y="12" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.03" />
            <path d="M13.5 12V10a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-center space-y-3 max-w-md">
          <div className="eyebrow">Nothing locked yet</div>
          <h3 className="font-display text-3xl tracking-tight">
            No vaults.
            <br />
            <span className="text-cyan">Start with $5.</span>
          </h3>
          <p className="text-muted text-sm leading-relaxed">
            Cash out. Lock it. Thank yourself later.
          </p>
          <p className="text-xs text-faint pt-2 tabular">
            Connected: {truncated} on {chainConfig.name}
          </p>
        </div>
        <Link href="/create" className="btn-primary btn-lg">
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
    <div className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 pb-24 space-y-10">
      {chainConfig.usdcNote && (
        <p className="text-[11px] text-faint leading-relaxed pt-1">
          {chainConfig.usdcNote}
        </p>
      )}
      {totals && (
        <div className="border-y border-line py-7">
          <ul className="flex flex-wrap items-baseline gap-x-10 gap-y-5">
            {/* Primary: the actionable number */}
            <li className="flex items-baseline gap-3">
              <span
                className={`font-display text-cyan text-4xl tabular tracking-tight leading-none ${totals.claimable > BigInt(0) ? "animate-claim-pulse" : ""}`}
              >
                {formatUnits(totals.claimable, usdcDecimals)}
              </span>
              <span className="eyebrow">Claimable now</span>
            </li>
            {/* Context: what's behind it */}
            <li className="flex items-baseline gap-2">
              <span className="font-display text-foreground text-xl tabular tracking-tight">
                {formatUnits(totals.locked, usdcDecimals)}
              </span>
              <span className="eyebrow text-faint">Total locked</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="font-display text-foreground text-xl tabular tracking-tight">
                {formatUnits(totals.claimed, usdcDecimals)}
              </span>
              <span className="eyebrow text-faint">Claimed</span>
            </li>
          </ul>
        </div>
      )}
      {fetchSource === "onchain" && (
        <div className="flex items-center gap-2 text-xs text-faint tabular">
          <span className="w-1.5 h-1.5 rounded-full bg-warning/70" />
          Loaded from on-chain (indexer unavailable)
        </div>
      )}
      {failedStreamCount > 0 && (
        <div className="bg-warning/10 border border-warning/25 rounded-lg px-4 py-3 text-sm text-warning flex items-center gap-3">
          <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            {failedStreamCount} {failedStreamCount === 1 ? "vault" : "vaults"} failed to load.{" "}
            <button onClick={retryFetch} className="underline hover:text-foreground transition-colors">
              Retry
            </button>
          </span>
        </div>
      )}
      <div className="space-y-px bg-line border border-line rounded-lg overflow-hidden">
        {vaults.map((vault, i) => (
          <CardErrorBoundary key={vault.streamId.toString()} label={`Lock #${vault.streamId.toString()}`}>
            <VaultCard
              vault={vault}
              onClaim={handleClaim}
              claimingId={claimingId}
              index={i}
              chainId={chainId}
              usdcDecimals={usdcDecimals}
              sablierAddress={sablierLockup}
              explorerUrl={explorerUrl}
            />
          </CardErrorBoundary>
        ))}
      </div>
      <div className="pt-2">
        <Link
          href="/create"
          className="text-sm text-muted hover:text-cyan transition-colors"
        >
          Lock another win →
        </Link>
      </div>
    </div>
  );
}

export default function Vaults() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <div className="border-b border-line px-6 py-2.5 text-center text-xs tabular text-subtle">
        RipGuard is the UI. Sablier is the bank. Non-custodial. Immutable.
      </div>

      <main className="relative flex-1 flex flex-col">
        {/* Ambient backdrop */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[520px] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,oklch(0.30_0.060_200/0.35),transparent_70%)]" />
          <div className="absolute inset-0 grid-overlay" />
        </div>

        <div className="relative w-full max-w-4xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-10">
          <div className="eyebrow mb-5 flex items-center gap-3">
            <span className="h-px w-10 bg-cyan/60" />
            Your vaults
          </div>
          <h1 className="text-display max-w-2xl">
            Your past self
            <br />
            <span className="text-cyan">paying you back.</span>
          </h1>
          <p className="mt-5 text-muted leading-relaxed max-w-[52ch]">
            Every lock you signed, in one place. Watch them reload. Claim
            when the clock says you can.
          </p>
        </div>

        <div className="relative flex-1 flex flex-col">
          <ErrorBoundary fallbackTitle="Failed to load vaults">
            <WrongChainPanel>
              <VaultDashboard />
            </WrongChainPanel>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
