import { PublicKey, type AccountInfo, type Connection } from "@solana/web3.js";

import { LAMPORTS_PER_SOL } from "./format";

/**
 * Pyth's sponsored SOL/USD PriceUpdateV2 account (shard 0). Pyth uses the
 * same account on mainnet-beta and devnet.
 *
 * https://docs.pyth.network/price-feeds/core/push-feeds/solana
 */
export const PYTH_SOL_USD_ACCOUNT = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
);

const PYTH_RECEIVER_PROGRAM = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
);
const PRICE_UPDATE_V2_DISCRIMINATOR = Uint8Array.from([
  0x22, 0xf1, 0x23, 0x63, 0x9d, 0x7e, 0xf4, 0xcd,
]);
const SOL_USD_FEED_ID = Uint8Array.from([
  0xef, 0x0d, 0x8b, 0x6f, 0xda, 0x2c, 0xeb, 0xa4,
  0x1d, 0xa1, 0x5d, 0x40, 0x95, 0xd1, 0xda, 0x39,
  0x2a, 0x0d, 0x2f, 0x8e, 0xd0, 0xc6, 0xc7, 0xbc,
  0x0f, 0x4c, 0xfa, 0xc8, 0xc2, 0x80, 0xb5, 0x6d,
]);

// PriceUpdateV2 is 134 allocated bytes. A fully verified update uses one
// Borsh enum byte, leaving the final allocation byte unused.
const PRICE_UPDATE_V2_LENGTH = 134;
const VERIFICATION_LEVEL_OFFSET = 40;
const FULL_VERIFICATION_LEVEL = 1;
const FEED_ID_OFFSET = 41;
const PRICE_OFFSET = 73;
const EXPONENT_OFFSET = 89;
const PUBLISH_TIME_OFFSET = 93;
const MAX_CLOCK_SKEW_MS = 60_000;
const MAX_ABS_EXPONENT = 18;

/** Three missed one-minute Pyth heartbeats make an estimate stale. */
export const SOL_USD_STALE_AFTER_MS = 3 * 60_000;

export type SolUsdQuote = Readonly<{
  price: bigint;
  exponent: number;
  publishTimeMs: number;
  fetchedAtMs: number;
}>;

export type SolUsdDecodeResult =
  | Readonly<{ kind: "valid"; quote: SolUsdQuote }>
  | Readonly<{
      kind: "invalid";
      reason:
        | "owner"
        | "length"
        | "discriminator"
        | "verification"
        | "feed-id"
        | "price"
        | "exponent"
        | "publish-time";
    }>;

function bytesEqual(
  data: Uint8Array,
  offset: number,
  expected: Uint8Array,
): boolean {
  for (let index = 0; index < expected.length; index += 1) {
    if (data[offset + index] !== expected[index]) return false;
  }
  return true;
}

/**
 * Parse the RPC account into a quote only after its owner, Anchor account
 * discriminator, verification level, feed ID, and numeric bounds agree.
 * Invalid oracle bytes never reach amount formatting.
 */
export function decodePythSolUsdAccount(
  account: Pick<AccountInfo<Uint8Array>, "owner" | "data">,
  fetchedAtMs: number,
): SolUsdDecodeResult {
  if (!account.owner.equals(PYTH_RECEIVER_PROGRAM)) {
    return { kind: "invalid", reason: "owner" };
  }
  if (account.data.byteLength !== PRICE_UPDATE_V2_LENGTH) {
    return { kind: "invalid", reason: "length" };
  }
  if (!bytesEqual(account.data, 0, PRICE_UPDATE_V2_DISCRIMINATOR)) {
    return { kind: "invalid", reason: "discriminator" };
  }
  if (account.data[VERIFICATION_LEVEL_OFFSET] !== FULL_VERIFICATION_LEVEL) {
    return { kind: "invalid", reason: "verification" };
  }
  if (!bytesEqual(account.data, FEED_ID_OFFSET, SOL_USD_FEED_ID)) {
    return { kind: "invalid", reason: "feed-id" };
  }

  const view = new DataView(
    account.data.buffer,
    account.data.byteOffset,
    account.data.byteLength,
  );
  const price = view.getBigInt64(PRICE_OFFSET, true);
  if (price <= 0n) return { kind: "invalid", reason: "price" };

  const exponent = view.getInt32(EXPONENT_OFFSET, true);
  if (Math.abs(exponent) > MAX_ABS_EXPONENT) {
    return { kind: "invalid", reason: "exponent" };
  }

  const publishTimeSeconds = view.getBigInt64(PUBLISH_TIME_OFFSET, true);
  const maximumTimestampSeconds = BigInt(
    Math.floor(Number.MAX_SAFE_INTEGER / 1000),
  );
  if (
    publishTimeSeconds <= 0n ||
    publishTimeSeconds > maximumTimestampSeconds ||
    !Number.isSafeInteger(fetchedAtMs) ||
    fetchedAtMs < 0
  ) {
    return { kind: "invalid", reason: "publish-time" };
  }
  const publishTimeMs = Number(publishTimeSeconds) * 1000;
  if (publishTimeMs > fetchedAtMs + MAX_CLOCK_SKEW_MS) {
    return { kind: "invalid", reason: "publish-time" };
  }

  return {
    kind: "valid",
    quote: Object.freeze({ price, exponent, publishTimeMs, fetchedAtMs }),
  };
}

/** Fetch through the wallet's existing RPC connection; no HTTP price API. */
export async function fetchSolUsdQuote(
  connection: Connection,
): Promise<SolUsdQuote> {
  const account = await connection.getAccountInfo(PYTH_SOL_USD_ACCOUNT, {
    commitment: "confirmed",
  });
  if (account === null) throw new Error("Pyth SOL/USD account is unavailable.");

  const result = decodePythSolUsdAccount(account, Date.now());
  if (result.kind === "invalid") {
    throw new Error(`Pyth SOL/USD account failed ${result.reason} validation.`);
  }
  return result.quote;
}

export function isSolUsdQuoteStale(
  quote: SolUsdQuote,
  nowMs: number,
): boolean {
  return nowMs - quote.publishTimeMs > SOL_USD_STALE_AFTER_MS;
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/** Format a lamport amount as a rounded, fixed-point USD estimate. */
export function formatUsdEstimate(
  lamports: bigint,
  quote: SolUsdQuote,
): string {
  const positiveLamports = lamports < 0n ? -lamports : lamports;
  let numerator = positiveLamports * quote.price * 100n;
  let denominator = LAMPORTS_PER_SOL;
  if (quote.exponent < 0) {
    denominator *= powerOfTen(-quote.exponent);
  } else {
    numerator *= powerOfTen(quote.exponent);
  }

  const cents = (numerator + denominator / 2n) / denominator;
  if (positiveLamports > 0n && cents === 0n) return "<$0.01";

  const dollars = cents / 100n;
  const fractional = (cents % 100n).toString().padStart(2, "0");
  const sign = lamports < 0n ? "-" : "";
  return `${sign}$${dollars.toLocaleString("en-US")}.${fractional}`;
}
