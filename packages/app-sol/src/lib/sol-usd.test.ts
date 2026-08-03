import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  SOL_USD_STALE_AFTER_MS,
  decodePythSolUsdAccount,
  formatUsdEstimate,
  isSolUsdQuoteStale,
  type SolUsdQuote,
} from "./sol-usd";

const RECEIVER_PROGRAM = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
);
const FETCHED_AT_MS = 1_800_000_000_000;
const PUBLISHED_AT_SECONDS = 1_799_999_970;

function validAccountData(): Uint8Array {
  const data = new Uint8Array(134);
  data.set([0x22, 0xf1, 0x23, 0x63, 0x9d, 0x7e, 0xf4, 0xcd], 0);
  data[40] = 1;
  data.set(
    Uint8Array.from(
      Buffer.from(
        "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
        "hex",
      ),
    ),
    41,
  );
  const view = new DataView(data.buffer);
  view.setBigInt64(73, 14_025_000_000n, true);
  view.setBigUint64(81, 1_000_000n, true);
  view.setInt32(89, -8, true);
  view.setBigInt64(93, BigInt(PUBLISHED_AT_SECONDS), true);
  view.setBigInt64(101, BigInt(PUBLISHED_AT_SECONDS - 1), true);
  view.setBigInt64(109, 14_000_000_000n, true);
  view.setBigUint64(117, 1_000_000n, true);
  view.setBigUint64(125, 123_456n, true);
  return data;
}

function validAccount() {
  return { owner: RECEIVER_PROGRAM, data: validAccountData() };
}

function validQuote(overrides: Partial<SolUsdQuote> = {}): SolUsdQuote {
  return {
    price: 14_025_000_000n,
    exponent: -8,
    publishTimeMs: PUBLISHED_AT_SECONDS * 1000,
    fetchedAtMs: FETCHED_AT_MS,
    ...overrides,
  };
}

describe("decodePythSolUsdAccount", () => {
  it("decodes the fully verified SOL/USD PriceUpdateV2 layout", () => {
    expect(decodePythSolUsdAccount(validAccount(), FETCHED_AT_MS)).toStrictEqual({
      kind: "valid",
      quote: {
        price: 14_025_000_000n,
        exponent: -8,
        publishTimeMs: PUBLISHED_AT_SECONDS * 1000,
        fetchedAtMs: FETCHED_AT_MS,
      },
    });
  });

  it("rejects an account owned by another program", () => {
    expect(
      decodePythSolUsdAccount(
        { ...validAccount(), owner: PublicKey.default },
        FETCHED_AT_MS,
      ),
    ).toStrictEqual({ kind: "invalid", reason: "owner" });
  });

  it("rejects a different account allocation", () => {
    expect(
      decodePythSolUsdAccount(
        { owner: RECEIVER_PROGRAM, data: new Uint8Array(133) },
        FETCHED_AT_MS,
      ),
    ).toStrictEqual({ kind: "invalid", reason: "length" });
  });

  it("rejects a different Anchor account type", () => {
    const account = validAccount();
    account.data[0] ^= 0xff;
    expect(decodePythSolUsdAccount(account, FETCHED_AT_MS)).toStrictEqual({
      kind: "invalid",
      reason: "discriminator",
    });
  });

  it("rejects a partial-verification update", () => {
    const account = validAccount();
    account.data[40] = 0;
    expect(decodePythSolUsdAccount(account, FETCHED_AT_MS)).toStrictEqual({
      kind: "invalid",
      reason: "verification",
    });
  });

  it("rejects a different Pyth feed", () => {
    const account = validAccount();
    account.data[41] ^= 0xff;
    expect(decodePythSolUsdAccount(account, FETCHED_AT_MS)).toStrictEqual({
      kind: "invalid",
      reason: "feed-id",
    });
  });

  it("rejects a non-positive price", () => {
    const account = validAccount();
    new DataView(account.data.buffer).setBigInt64(73, 0n, true);
    expect(decodePythSolUsdAccount(account, FETCHED_AT_MS)).toStrictEqual({
      kind: "invalid",
      reason: "price",
    });
  });

  it("rejects an implausible exponent", () => {
    const account = validAccount();
    new DataView(account.data.buffer).setInt32(89, -19, true);
    expect(decodePythSolUsdAccount(account, FETCHED_AT_MS)).toStrictEqual({
      kind: "invalid",
      reason: "exponent",
    });
  });

  it("rejects a publish time beyond the clock-skew allowance", () => {
    const account = validAccount();
    new DataView(account.data.buffer).setBigInt64(
      93,
      BigInt(Math.floor(FETCHED_AT_MS / 1000) + 61),
      true,
    );
    expect(decodePythSolUsdAccount(account, FETCHED_AT_MS)).toStrictEqual({
      kind: "invalid",
      reason: "publish-time",
    });
  });
});

describe("isSolUsdQuoteStale", () => {
  it("changes to stale only after three missed one-minute heartbeats", () => {
    const quote = validQuote({ publishTimeMs: FETCHED_AT_MS });
    expect(
      isSolUsdQuoteStale(quote, FETCHED_AT_MS + SOL_USD_STALE_AFTER_MS),
    ).toBe(false);
    expect(
      isSolUsdQuoteStale(quote, FETCHED_AT_MS + SOL_USD_STALE_AFTER_MS + 1),
    ).toBe(true);
  });
});

describe("formatUsdEstimate", () => {
  it("formats SOL at the quote using fixed-point arithmetic", () => {
    expect(formatUsdEstimate(1_000_000_000n, validQuote())).toBe("$140.25");
  });

  it("rounds to cents and adds thousands separators", () => {
    expect(formatUsdEstimate(12_345_678_900n, validQuote())).toBe("$1,731.48");
  });

  it("shows positive sub-cent amounts instead of zero", () => {
    expect(formatUsdEstimate(1n, validQuote())).toBe("<$0.01");
  });

  it("supports a positive Pyth exponent", () => {
    expect(
      formatUsdEstimate(
        2_000_000_000n,
        validQuote({ price: 14n, exponent: 1 }),
      ),
    ).toBe("$280.00");
  });
});
