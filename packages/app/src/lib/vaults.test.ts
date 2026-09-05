import { describe, it, expect, vi } from "vitest";
import { type Address } from "viem";
import { type ChainConfig } from "@/config/chains";
import {
  IndexerError,
  fetchIndexedStreams,
  getScheduleType,
  isRetryableIndexerError,
  knownStreamIds,
  readStreamsOnChain,
  rememberStreamIds,
  splitByChain,
  streamCacheKey,
  type StreamRecord,
} from "./vaults";

const OWNER: Address = "0xCa7F0d1CCd2A9d9b935D72957E8dFdC56CaF3d71";
const OTHER: Address = "0x1111111111111111111111111111111111111111";

const BSC: ChainConfig = {
  chainId: 56,
  name: "BNB Chain",
  shortName: "BNB",
  sablierLockup: "0x6E0baD2c077d699841F1929b45bfb93FAfBEd395",
  usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  usdcDecimals: 18,
  treasury: "0x847F640bE052b0700C31F72Dce622F4C6286934E",
  explorerUrl: "https://bscscan.com",
  explorerName: "BscScan",
  rpcUrls: ["https://bsc-rpc.publicnode.com"],
  isTestnet: false,
};
const BASE: ChainConfig = {
  ...BSC,
  chainId: 8453,
  name: "Base",
  shortName: "Base",
  sablierLockup: "0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B",
  usdcDecimals: 6,
};

// Wire shape from the Envio indexer (numerics as strings, cliffTime nullable).
const ROW_1645 = {
  chainId: "56",
  contract: "0x6e0bad2c077d699841f1929b45bfb93fafbed395",
  tokenId: "1645",
  depositAmount: "3030000000000000000000",
  withdrawnAmount: "0",
  startTime: "1788527705",
  endTime: "1790323209",
  cliffTime: "1790323208",
};
const ROW_BASE_711 = {
  chainId: "8453",
  contract: "0xb5d78dd3276325f5faf3106cc4acc56e28e0fe3b",
  tokenId: "711",
  depositAmount: "5000000",
  withdrawnAmount: "1000000",
  startTime: "1788000000",
  endTime: "1788600000",
  cliffTime: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchIndexedStreams", () => {
  it("asks for every chain in one request with lower-cased addresses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { LockupStream: [] } }));
    await fetchIndexedStreams(OWNER, [BSC, BASE], fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.variables).toEqual({
      recipient: OWNER.toLowerCase(),
      chainIds: ["56", "8453"],
      contracts: [BSC.sablierLockup.toLowerCase(), BASE.sablierLockup.toLowerCase()],
    });
  });

  it("parses wire strings into bigint / seconds and maps null cliff to 0", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { LockupStream: [ROW_1645, ROW_BASE_711] } }));
    const streams = await fetchIndexedStreams(OWNER, [BSC, BASE], fetchImpl);

    expect(streams).toEqual<StreamRecord[]>([
      {
        chainId: 56,
        tokenId: BigInt(1645),
        deposited: BigInt("3030000000000000000000"),
        withdrawn: BigInt(0),
        startTime: 1788527705,
        endTime: 1790323209,
        cliffTime: 1790323208,
      },
      {
        chainId: 8453,
        tokenId: BigInt(711),
        deposited: BigInt(5_000_000),
        withdrawn: BigInt(1_000_000),
        startTime: 1788000000,
        endTime: 1788600000,
        cliffTime: 0,
      },
    ]);
  });

  it("accepts JSON numbers for numeric fields", async () => {
    const row = { ...ROW_BASE_711, chainId: 8453, tokenId: 711, startTime: 1788000000 };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: { LockupStream: [row] } }));
    const [stream] = await fetchIndexedStreams(OWNER, [BASE], fetchImpl);
    expect(stream.chainId).toBe(8453);
    expect(stream.tokenId).toBe(BigInt(711));
  });

  it("drops streams from a different Sablier contract on the same chain", async () => {
    const foreign = { ...ROW_1645, contract: "0x000000000000000000000000000000000000dead" };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { LockupStream: [foreign, ROW_1645] } }));
    const streams = await fetchIndexedStreams(OWNER, [BSC], fetchImpl);
    expect(streams.map((s) => s.tokenId)).toEqual([BigInt(1645)]);
  });

  it("throws a retryable IndexerError on 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    const err = await fetchIndexedStreams(OWNER, [BSC], fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(IndexerError);
    expect(err.status).toBe(429);
    expect(isRetryableIndexerError(err)).toBe(true);
  });

  it("throws a retryable IndexerError when the network fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await fetchIndexedStreams(OWNER, [BSC], fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(IndexerError);
    expect(err.status).toBeNull();
    expect(isRetryableIndexerError(err)).toBe(true);
  });

  it("treats GraphQL errors and malformed rows as non-retryable", async () => {
    const gqlErr = await fetchIndexedStreams(
      OWNER,
      [BSC],
      vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: "field not found" }] })),
    ).catch((e) => e);
    expect(gqlErr).toBeInstanceOf(IndexerError);
    expect(gqlErr.message).toMatch(/field not found/);
    expect(isRetryableIndexerError(gqlErr)).toBe(false);

    const badRow = { ...ROW_1645, depositAmount: "3030.5" };
    const rowErr = await fetchIndexedStreams(
      OWNER,
      [BSC],
      vi.fn().mockResolvedValue(jsonResponse({ data: { LockupStream: [badRow] } })),
    ).catch((e) => e);
    expect(rowErr).toBeInstanceOf(IndexerError);
    expect(rowErr.message).toMatch(/depositAmount/);
    expect(isRetryableIndexerError(rowErr)).toBe(false);
  });

  it("does not treat arbitrary errors as retryable indexer errors", () => {
    expect(isRetryableIndexerError(new Error("Request failed with 429"))).toBe(false);
  });
});

describe("splitByChain", () => {
  const mk = (chainId: number, tokenId: number): StreamRecord => ({
    chainId,
    tokenId: BigInt(tokenId),
    deposited: BigInt(1),
    withdrawn: BigInt(0),
    startTime: 1,
    endTime: 2,
    cliffTime: 0,
  });

  it("separates the active chain from counts elsewhere", () => {
    const { current, elsewhere } = splitByChain(
      [mk(56, 1), mk(8453, 2), mk(56, 3), mk(42161, 4), mk(8453, 5)],
      56,
    );
    expect(current.map((s) => Number(s.tokenId))).toEqual([1, 3]);
    expect(elsewhere).toEqual([
      { chainId: 8453, count: 2 },
      { chainId: 42161, count: 1 },
    ]);
  });

  it("returns empty structures for no streams", () => {
    expect(splitByChain([], 56)).toEqual({ current: [], elsewhere: [] });
  });
});

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("device memory of stream IDs", () => {
  it("returns nothing without storage", () => {
    expect(knownStreamIds(null, 56, OWNER)).toEqual([]);
  });

  it("round-trips the indexer result, keyed by chain and lower-cased wallet", () => {
    const storage = memoryStorage();
    rememberStreamIds(storage, 56, OWNER, [BigInt(1645), BigInt(1646)]);

    expect(storage.getItem(streamCacheKey(56, OWNER))).toBe('["1645","1646"]');
    expect(knownStreamIds(storage, 56, OWNER)).toEqual([BigInt(1646), BigInt(1645)]);
    expect(knownStreamIds(storage, 56, OTHER)).toEqual([]);
    expect(knownStreamIds(storage, 8453, OWNER)).toEqual([]);
  });

  it("unions /create's label keys for the same chain and de-duplicates", () => {
    const storage = memoryStorage({
      "ripguard:lock:56:1644": "Lock until Aug 31, 2026",
      "ripguard:lock:56:1645": "Lock until Sep 24, 2026",
      "ripguard:lock:8453:9": "Steady reloads",
      "ripguard:lock:56:not-an-id": "garbage",
    });
    rememberStreamIds(storage, 56, OWNER, [BigInt(1645), BigInt(1646)]);

    expect(knownStreamIds(storage, 56, OWNER)).toEqual([
      BigInt(1646),
      BigInt(1645),
      BigInt(1644),
    ]);
  });

  it("survives a corrupt cache entry", () => {
    const storage = memoryStorage({
      [streamCacheKey(56, OWNER)]: "{not json",
      "ripguard:lock:56:7": "One Drop",
    });
    expect(knownStreamIds(storage, 56, OWNER)).toEqual([BigInt(7)]);
  });

  it("swallows storage write failures", () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    expect(() => rememberStreamIds(storage, 56, OWNER, [BigInt(1)])).not.toThrow();
  });
});

describe("readStreamsOnChain", () => {
  type Result = { status: "success"; result: unknown } | { status: "failure"; error: Error };
  const ok = (result: unknown): Result => ({ status: "success", result });
  const fail = (msg: string): Result => ({ status: "failure", error: new Error(msg) });

  // Six reads per id, in STREAM_READS order.
  const owned = (owner: Address, start: number, end: number, cliff: number, dep: bigint, wd: bigint) => [
    ok(owner), ok(start), ok(end), ok(cliff), ok(dep), ok(wd),
  ];

  function client(results: Result[]) {
    const multicall = vi.fn().mockResolvedValue(results);
    return { client: { multicall } as never, multicall };
  }

  it("returns nothing and skips the RPC for no ids", async () => {
    const { client: c, multicall } = client([]);
    expect(await readStreamsOnChain(c, BSC, OWNER, [])).toEqual([]);
    expect(multicall).not.toHaveBeenCalled();
  });

  it("keeps only streams the wallet owns and sorts newest first", async () => {
    const { client: c, multicall } = client([
      ...owned(OWNER, 100, 200, 199, BigInt(5), BigInt(5)),
      ...owned(OTHER, 300, 400, 0, BigInt(9), BigInt(0)),
      ...owned(OWNER, 150, 250, 249, BigInt(3030), BigInt(0)),
      ...[fail("ERC721NonexistentToken"), ok(0), ok(0), ok(0), ok(BigInt(0)), ok(BigInt(0))],
    ]);
    const streams = await readStreamsOnChain(c, BSC, OWNER, [
      BigInt(1644), BigInt(1), BigInt(1645), BigInt(99999),
    ]);

    expect(multicall).toHaveBeenCalledTimes(1);
    const { contracts } = multicall.mock.calls[0][0];
    expect(contracts).toHaveLength(4 * 6);
    expect(contracts[0]).toMatchObject({
      address: BSC.sablierLockup,
      functionName: "ownerOf",
      args: [BigInt(1644)],
    });

    expect(streams).toEqual<StreamRecord[]>([
      { chainId: 56, tokenId: BigInt(1645), deposited: BigInt(3030), withdrawn: BigInt(0), startTime: 150, endTime: 250, cliffTime: 249 },
      { chainId: 56, tokenId: BigInt(1644), deposited: BigInt(5), withdrawn: BigInt(5), startTime: 100, endTime: 200, cliffTime: 199 },
    ]);
  });

  it("throws instead of rendering a partially-read owned stream", async () => {
    const { client: c } = client([
      ok(OWNER), ok(100), ok(200), ok(199), fail("rate limited"), ok(BigInt(0)),
    ]);
    await expect(readStreamsOnChain(c, BSC, OWNER, [BigInt(1644)])).rejects.toThrow(
      /stream #1644.*rate limited/,
    );
  });
});

describe("getScheduleType", () => {
  it("labels tranched streams regardless of shape", () => {
    expect(getScheduleType(0, 86400, true)).toBe("Strict Payouts");
  });

  it("treats Sablier's required one-second tail after the cliff as a single drop", () => {
    // /create writes lock-until and Panic Lock with total = cliff + 1.
    expect(getScheduleType(1795503, 1795504)).toBe("One Drop");
    expect(getScheduleType(86400, 86401)).toBe("One Drop");
    expect(getScheduleType(3600, 3600)).toBe("One Drop");
  });

  it("distinguishes a cliff followed by real reloads", () => {
    expect(getScheduleType(86400, 8 * 86400)).toBe("Wait, then reloads");
  });

  it("labels no-cliff streams as steady reloads", () => {
    expect(getScheduleType(0, 86400)).toBe("Steady reloads");
    expect(getScheduleType(0, 1)).toBe("Steady reloads");
  });
});
