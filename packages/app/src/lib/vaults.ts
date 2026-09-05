import { type Address, type PublicClient, isAddressEqual } from "viem";
import { sablierLockupAbi } from "@/config/abis";
import { type ChainConfig } from "@/config/chains";
import { retryWithBackoff } from "./retry";

// Sablier's Envio indexer — one endpoint for every chain, no API key. It
// rate-limits at 250 requests per 60 s per client IP (see x-ratelimit-*
// response headers), and a mobile user behind carrier NAT shares that budget
// with strangers. Hence one query for every deployment chain, never a fan-out.
export const SABLIER_INDEXER_URL = "https://indexer.hyperindex.xyz/53b7e25/v1/graphql";

/** A Sablier stream as /vaults needs it, already parsed from wire strings. */
export type StreamRecord = {
  chainId: number;
  tokenId: bigint;
  deposited: bigint;
  withdrawn: bigint;
  startTime: number;
  endTime: number;
  /** Unix seconds; 0 when the stream has no cliff. */
  cliffTime: number;
};

export class IndexerError extends Error {
  /** HTTP status, or null when the request never got a response. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "IndexerError";
    this.status = status;
  }
}

// Throttling, upstream outages and dropped connections clear on their own.
// A rejected query or a malformed row will not, and retrying those only
// burns the shared rate-limit budget.
export function isRetryableIndexerError(error: Error): boolean {
  if (!(error instanceof IndexerError)) return false;
  return error.status === null || error.status === 429 || error.status >= 500;
}

const STREAMS_QUERY = `query RipGuardVaults($recipient: String!, $chainIds: [numeric!]!, $contracts: [String!]!) {
  LockupStream(
    where: {
      recipient: { _eq: $recipient }
      chainId: { _in: $chainIds }
      contract: { _in: $contracts }
    }
    order_by: { startTime: desc }
  ) {
    chainId
    contract
    tokenId
    depositAmount
    withdrawnAmount
    startTime
    endTime
    cliffTime
  }
}`;

// Hasura serialises numerics as strings, but be liberal: a config change on
// their side that flips to JSON numbers must not read as "you have no vaults".
function asBigInt(value: unknown, field: string, status: number): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new IndexerError(`Indexer row has malformed ${field}: ${String(value)}`, status);
}

function asSeconds(value: unknown, field: string, status: number): number {
  const n = Number(asBigInt(value, field, status));
  if (!Number.isSafeInteger(n)) {
    throw new IndexerError(`Indexer row has out-of-range ${field}: ${String(value)}`, status);
  }
  return n;
}

function asLowerHex(value: unknown, field: string, status: number): string {
  if (typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) return value.toLowerCase();
  throw new IndexerError(`Indexer row has malformed ${field}: ${String(value)}`, status);
}

type ParsedRow = { contract: string; stream: StreamRecord };

function parseRow(row: unknown, status: number): ParsedRow {
  if (row === null || typeof row !== "object") {
    throw new IndexerError("Indexer row is not an object", status);
  }
  const r = row as Record<string, unknown>;
  const chainId = asSeconds(r.chainId, "chainId", status);
  return {
    contract: asLowerHex(r.contract, "contract", status),
    stream: {
      chainId,
      tokenId: asBigInt(r.tokenId, "tokenId", status),
      deposited: asBigInt(r.depositAmount, "depositAmount", status),
      withdrawn: asBigInt(r.withdrawnAmount, "withdrawnAmount", status),
      startTime: asSeconds(r.startTime, "startTime", status),
      endTime: asSeconds(r.endTime, "endTime", status),
      cliffTime:
        r.cliffTime === null || r.cliffTime === undefined
          ? 0
          : asSeconds(r.cliffTime, "cliffTime", status),
    },
  };
}

/**
 * Every stream `recipient` holds on any of `chains`, newest first.
 *
 * One round-trip for all chains. Throws IndexerError on any failure; a
 * malformed row fails the whole call rather than silently dropping a vault,
 * because a missing vault is indistinguishable from "lost funds" to a user.
 */
export async function fetchIndexedStreams(
  recipient: Address,
  chains: readonly ChainConfig[],
  fetchImpl: typeof fetch = fetch,
): Promise<StreamRecord[]> {
  const lockupByChain = new Map(chains.map((c) => [c.chainId, c.sablierLockup.toLowerCase()]));

  let res: Response;
  try {
    res = await fetchImpl(SABLIER_INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: STREAMS_QUERY,
        variables: {
          recipient: recipient.toLowerCase(),
          chainIds: chains.map((c) => String(c.chainId)),
          contracts: [...lockupByChain.values()],
        },
      }),
    });
  } catch (err) {
    throw new IndexerError(
      `Indexer unreachable: ${err instanceof Error ? err.message : String(err)}`,
      null,
    );
  }

  if (!res.ok) throw new IndexerError(`Indexer returned ${res.status}`, res.status);

  let json: { data?: { LockupStream?: unknown }; errors?: Array<{ message?: string }> };
  try {
    json = await res.json();
  } catch {
    throw new IndexerError("Indexer returned a non-JSON body", res.status);
  }
  if (json.errors?.length) {
    throw new IndexerError(json.errors[0]?.message ?? "Indexer query failed", res.status);
  }
  const rows = json.data?.LockupStream;
  if (!Array.isArray(rows)) {
    throw new IndexerError("Indexer response is missing LockupStream", res.status);
  }

  const streams: StreamRecord[] = [];
  for (const row of rows) {
    const { contract, stream } = parseRow(row, res.status);
    // The query pins contracts and chains as two independent sets, so a
    // stream on another Sablier deployment that happens to share a chain
    // could slip through — and it would render with the wrong claim target.
    if (lockupByChain.get(stream.chainId) !== contract) continue;
    streams.push(stream);
  }
  return streams;
}

/** `fetchIndexedStreams` with short retries on throttling / outages. */
export function fetchIndexedStreamsWithRetry(
  recipient: Address,
  chains: readonly ChainConfig[],
  fetchImpl: typeof fetch = fetch,
): Promise<StreamRecord[]> {
  return retryWithBackoff(() => fetchIndexedStreams(recipient, chains, fetchImpl), {
    maxAttempts: 3,
    baseDelay: 1500,
    shouldRetry: isRetryableIndexerError,
  });
}

export type ElsewhereCount = { chainId: number; count: number };

/** Streams on the active chain, plus how many live on each other chain. */
export function splitByChain(
  streams: readonly StreamRecord[],
  chainId: number,
): { current: StreamRecord[]; elsewhere: ElsewhereCount[] } {
  const current: StreamRecord[] = [];
  const counts = new Map<number, number>();
  for (const s of streams) {
    if (s.chainId === chainId) current.push(s);
    else counts.set(s.chainId, (counts.get(s.chainId) ?? 0) + 1);
  }
  return {
    current,
    elsewhere: [...counts].map(([id, count]) => ({ chainId: id, count })),
  };
}

// ---------------------------------------------------------------------------
// Device memory — the fallback when the indexer is down.
//
// /create writes `ripguard:lock:<chainId>:<streamId>` = preset label at lock
// time; those keys double as a discovery hint. We add our own cache of the
// last indexer result per (chain, wallet). Neither is authoritative: label
// keys are not wallet-scoped, so the on-chain read filters by ownerOf.
// Scanning Transfer logs is not a fallback option — public RPCs cap
// eth_getLogs at 1k–10k blocks, which is tens of thousands of sequential
// calls on BNB Chain.
// ---------------------------------------------------------------------------

const STREAM_CACHE_PREFIX = "ripguard:streams:";
const LOCK_LABEL_PREFIX = "ripguard:lock:";
const DECIMAL_ID = /^\d+$/;

export function streamCacheKey(chainId: number, owner: Address): string {
  return `${STREAM_CACHE_PREFIX}${chainId}:${owner.toLowerCase()}`;
}

/** Best-effort: private mode / quota errors are swallowed. */
export function rememberStreamIds(
  storage: Storage | null,
  chainId: number,
  owner: Address,
  ids: readonly bigint[],
): void {
  if (!storage) return;
  try {
    storage.setItem(streamCacheKey(chainId, owner), JSON.stringify(ids.map(String)));
  } catch {
    // Cache is an optimisation for the indexer-down path only.
  }
}

/** Stream IDs this device has seen for (chain, wallet), newest ID first. */
export function knownStreamIds(storage: Storage | null, chainId: number, owner: Address): bigint[] {
  if (!storage) return [];
  const ids = new Set<string>();

  try {
    const cached: unknown = JSON.parse(storage.getItem(streamCacheKey(chainId, owner)) ?? "[]");
    if (Array.isArray(cached)) {
      for (const v of cached) if (typeof v === "string" && DECIMAL_ID.test(v)) ids.add(v);
    }
  } catch {
    // Corrupt cache entry — the label keys below still count.
  }

  try {
    const labelPrefix = `${LOCK_LABEL_PREFIX}${chainId}:`;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(labelPrefix)) continue;
      const id = key.slice(labelPrefix.length);
      if (DECIMAL_ID.test(id)) ids.add(id);
    }
  } catch {
    // Storage unavailable.
  }

  return [...ids].map(BigInt).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

// ownerOf first so transferred, burned and foreign IDs drop out instead of
// rendering someone else's vault.
const STREAM_READS = [
  "ownerOf",
  "getStartTime",
  "getEndTime",
  "getCliffTime",
  "getDepositedAmount",
  "getWithdrawnAmount",
] as const;

/**
 * Read `ids` straight from Sablier and keep the ones `owner` still holds.
 *
 * Throws if any read for an owned stream fails — partial data would show a
 * wrong balance, which is worse than the error state.
 */
export async function readStreamsOnChain(
  client: PublicClient,
  chain: ChainConfig,
  owner: Address,
  ids: readonly bigint[],
): Promise<StreamRecord[]> {
  if (ids.length === 0) return [];

  const contracts = ids.flatMap((id) =>
    STREAM_READS.map((functionName) => ({
      address: chain.sablierLockup,
      abi: sablierLockupAbi,
      functionName,
      args: [id] as const,
    })),
  );
  const results = await client.multicall({ contracts });

  const streams: StreamRecord[] = [];
  ids.forEach((id, i) => {
    const base = i * STREAM_READS.length;
    const [ownerRes, start, end, cliff, deposited, withdrawn] = results.slice(
      base,
      base + STREAM_READS.length,
    );
    // ownerOf reverts for burned / never-minted IDs: not ours, skip.
    if (ownerRes.status !== "success") return;
    if (!isAddressEqual(ownerRes.result as Address, owner)) return;

    for (const r of [start, end, cliff, deposited, withdrawn]) {
      if (r.status !== "success") {
        throw new Error(`On-chain read failed for stream #${id}: ${r.error?.message ?? "unknown"}`);
      }
    }
    streams.push({
      chainId: chain.chainId,
      tokenId: id,
      deposited: deposited.result as bigint,
      withdrawn: withdrawn.result as bigint,
      startTime: Number(start.result),
      endTime: Number(end.result),
      cliffTime: Number(cliff.result),
    });
  });

  return streams.sort((a, b) => b.startTime - a.startTime);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * Generic schedule label when no preset label was remembered at lock time.
 *
 * Sablier requires cliff < total, so /create writes "lock until" and Panic
 * Lock streams with total = cliff + 1 s. That one-second tail is still a
 * single drop, not a reload schedule.
 */
export function getScheduleType(
  cliffSeconds: number,
  totalSeconds: number,
  isTranched = false,
): string {
  if (isTranched) return "Strict Payouts";
  if (cliffSeconds > 0 && cliffSeconds >= totalSeconds - 1) return "One Drop";
  if (cliffSeconds > 0) return "Wait, then reloads";
  return "Steady reloads";
}
