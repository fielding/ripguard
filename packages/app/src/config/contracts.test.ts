import { describe, it, expect } from "vitest";
import {
  PRESETS,
  BROKER_FEE_RATE,
  brokerFeeForTreasury,
  brokerFeePctString,
  computeBrokerFee,
} from "./contracts";
import { ZERO_ADDRESS } from "./chains";

describe("PRESETS", () => {
  it("all presets have required fields", () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      expect(preset.label, `${key} missing label`).toBeTruthy();
      expect(preset.description, `${key} missing description`).toBeTruthy();
      expect(typeof preset.cliffSeconds, `${key} cliffSeconds not number`).toBe("number");
      expect(typeof preset.totalSeconds, `${key} totalSeconds not number`).toBe("number");
      expect(typeof preset.isLumpSum, `${key} isLumpSum not boolean`).toBe("boolean");
    }
  });

  it("totalSeconds is always > 0", () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      expect(preset.totalSeconds, `${key} totalSeconds must be positive`).toBeGreaterThan(0);
    }
  });

  it("cliffSeconds <= totalSeconds for all presets", () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      expect(
        preset.cliffSeconds,
        `${key}: cliff (${preset.cliffSeconds}) exceeds total (${preset.totalSeconds})`
      ).toBeLessThanOrEqual(preset.totalSeconds);
    }
  });

  it("cliff presets have cliff < total (Sablier requirement)", () => {
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (preset.cliffSeconds > 0) {
        expect(
          preset.cliffSeconds,
          `${key}: Sablier requires cliff < total strictly`
        ).toBeLessThan(preset.totalSeconds);
      }
    }
  });

  it("hourly presets have no cliff", () => {
    const hourlyKeys = Object.keys(PRESETS).filter((k) => k.startsWith("hourly") || k.startsWith("daily"));
    for (const key of hourlyKeys) {
      const preset = PRESETS[key as keyof typeof PRESETS];
      expect(preset.cliffSeconds, `${key} should have no cliff`).toBe(0);
    }
  });

  it("panic lock presets have cliff > 0", () => {
    const panicKeys = Object.keys(PRESETS).filter((k) => k.startsWith("panic"));
    expect(panicKeys.length).toBeGreaterThan(0);
    for (const key of panicKeys) {
      const preset = PRESETS[key as keyof typeof PRESETS];
      expect(preset.cliffSeconds, `${key} should have a cliff`).toBeGreaterThan(0);
    }
  });
});

describe("BROKER_FEE_RATE", () => {
  it("is a bigint", () => {
    expect(typeof BROKER_FEE_RATE).toBe("bigint");
  });

  it("is <= 1% (1e16 in 1e18 scale)", () => {
    // Sanity check: fee should never be more than 1%
    expect(BROKER_FEE_RATE).toBeLessThanOrEqual(BigInt("10000000000000000"));
  });

  it("is exactly 0.5% (5e15)", () => {
    expect(BROKER_FEE_RATE).toBe(BigInt("5000000000000000"));
  });
});

describe("brokerFeeForTreasury", () => {
  it("returns 0 for zero-address treasury (Sablier reverts otherwise)", () => {
    expect(brokerFeeForTreasury(ZERO_ADDRESS)).toBe(BigInt(0));
  });

  it("returns BROKER_FEE_RATE for a real treasury", () => {
    expect(brokerFeeForTreasury("0x847F640bE052b0700C31F72Dce622F4C6286934E")).toBe(
      BROKER_FEE_RATE
    );
  });
});

describe("brokerFeePctString", () => {
  it("returns 0% for zero fee", () => {
    expect(brokerFeePctString(BigInt(0))).toBe("0%");
  });

  it("formats 5e15 as 0.5%", () => {
    expect(brokerFeePctString(BROKER_FEE_RATE)).toBe("0.5%");
  });
});

describe("computeBrokerFee", () => {
  // USDC is 6 decimals on every chain we care about (Base, Solana mainnet).
  const usdc = (n: number | bigint) => BigInt(n) * BigInt(1_000_000);

  it("returns 0 for zero amount", () => {
    expect(computeBrokerFee(BigInt(0), BROKER_FEE_RATE)).toBe(BigInt(0));
  });

  it("returns 0 for zero rate (fee disabled, e.g. testnet)", () => {
    expect(computeBrokerFee(usdc(1000), BigInt(0))).toBe(BigInt(0));
  });

  it("0.5% of 1000 USDC = 5 USDC", () => {
    expect(computeBrokerFee(usdc(1000), BROKER_FEE_RATE)).toBe(usdc(5));
  });

  it("0.5% of 100 USDC = 0.5 USDC (500_000 in 6dp)", () => {
    expect(computeBrokerFee(usdc(100), BROKER_FEE_RATE)).toBe(BigInt(500_000));
  });

  it("0.5% of 1 USDC = 0.005 USDC (5000 in 6dp)", () => {
    expect(computeBrokerFee(usdc(1), BROKER_FEE_RATE)).toBe(BigInt(5_000));
  });

  it("rounds toward zero (floor) on non-divisible amounts", () => {
    // 0.5% of 333_333 (= 0.333333 USDC) = 1666.665 → 1666
    expect(computeBrokerFee(BigInt(333_333), BROKER_FEE_RATE)).toBe(
      BigInt(1_666),
    );
  });

  it("rounds 0.5% of 1 base unit down to 0 (deposit too small)", () => {
    // 0.5% of 1 = 0.005 → 0. Caller's responsibility to handle.
    expect(computeBrokerFee(BigInt(1), BROKER_FEE_RATE)).toBe(BigInt(0));
  });

  it("rounds 0.5% of 199 base units down to 0", () => {
    // 199 * 5e15 / 1e18 = 0.995 → 0
    expect(computeBrokerFee(BigInt(199), BROKER_FEE_RATE)).toBe(BigInt(0));
  });

  it("rounds 0.5% of 200 base units to exactly 1", () => {
    // 200 * 5e15 / 1e18 = 1.0 → 1
    expect(computeBrokerFee(BigInt(200), BROKER_FEE_RATE)).toBe(BigInt(1));
  });

  it("handles amounts up to u64 max without overflow", () => {
    // u64 max = 2^64-1; tokens on Solana are u64. (amount * rate) is bigint
    // in JS so no native overflow, but verify the math doesn't pathologize.
    const u64Max = BigInt("18446744073709551615");
    const fee = computeBrokerFee(u64Max, BROKER_FEE_RATE);
    expect(fee).toBeGreaterThan(BigInt(0));
    expect(fee).toBeLessThan(u64Max);
    // 0.5% of u64 max should be < 1% so should comfortably fit in u64.
    expect(fee).toBeLessThan(u64Max / BigInt(100));
  });

  it("brokerFeeForTreasury * computeBrokerFee parity (zero treasury → zero fee)", () => {
    expect(computeBrokerFee(usdc(1000), brokerFeeForTreasury(ZERO_ADDRESS))).toBe(
      BigInt(0),
    );
  });
});
