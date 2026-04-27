import { describe, it, expect } from "vitest";
import { BROKER_FEE_BPS, PRESETS, computeBrokerFee, ZERO_PUBKEY, TREASURY_PUBKEY } from "./solsab";

// USDC has 6 decimals on Solana. Same denomination shape as Base mainnet.
const usdc = (n: number | bigint) => BigInt(n) * BigInt(1_000_000);

describe("BROKER_FEE_BPS", () => {
  it("is 50 bps (0.5% — parity with EVM BROKER_FEE_RATE)", () => {
    expect(BROKER_FEE_BPS).toBe(BigInt(50));
  });

  it("is at most 100 bps (1%) — sanity bound", () => {
    expect(BROKER_FEE_BPS).toBeLessThanOrEqual(BigInt(100));
  });
});

describe("computeBrokerFee", () => {
  // Note: every test here implicitly runs with TREASURY_PUBKEY = ZERO_PUBKEY
  // because no NEXT_PUBLIC_TREASURY_PUBKEY is set in the test env. The
  // function returns 0 in that case (sentinel for "fee disabled").
  it("returns 0 when treasury is the zero pubkey (default test env)", () => {
    expect(TREASURY_PUBKEY.equals(ZERO_PUBKEY)).toBe(true);
    expect(computeBrokerFee(usdc(1000))).toBe(BigInt(0));
  });

  // The math itself — bypassing the treasury sentinel by passing through
  // the math directly via a synthetic helper. We unit-test the pure formula.
  describe("pure math (no treasury short-circuit)", () => {
    function pureSkim(amount: bigint, bps: bigint): bigint {
      return (amount * bps) / BigInt(10_000);
    }

    it("0.5% of 1000 USDC = 5 USDC", () => {
      expect(pureSkim(usdc(1000), BROKER_FEE_BPS)).toBe(usdc(5));
    });

    it("0.5% of 100 USDC = 0.5 USDC", () => {
      expect(pureSkim(usdc(100), BROKER_FEE_BPS)).toBe(BigInt(500_000));
    });

    it("0.5% of 1 USDC = 0.005 USDC", () => {
      expect(pureSkim(usdc(1), BROKER_FEE_BPS)).toBe(BigInt(5_000));
    });

    it("rounds toward zero on non-divisible amounts", () => {
      // 0.5% of 333_333 = 1666.665 → 1666
      expect(pureSkim(BigInt(333_333), BROKER_FEE_BPS)).toBe(BigInt(1_666));
    });

    it("rounds 0.5% of 199 base units to 0 (deposit too small)", () => {
      // 199 * 50 / 10000 = 0.995 → 0
      expect(pureSkim(BigInt(199), BROKER_FEE_BPS)).toBe(BigInt(0));
    });

    it("rounds 0.5% of 200 base units to 1", () => {
      expect(pureSkim(BigInt(200), BROKER_FEE_BPS)).toBe(BigInt(1));
    });

    it("0.5% of u64 max stays well under u64 max", () => {
      const u64Max = BigInt("18446744073709551615");
      const fee = pureSkim(u64Max, BROKER_FEE_BPS);
      expect(fee).toBeGreaterThan(BigInt(0));
      expect(fee).toBeLessThan(u64Max / BigInt(100));
    });
  });
});

describe("PRESETS", () => {
  it("matches EVM preset shape", () => {
    for (const [key, p] of Object.entries(PRESETS)) {
      expect(p.label, `${key} missing label`).toBeTruthy();
      expect(p.description, `${key} missing description`).toBeTruthy();
      expect(typeof p.cliffSeconds, `${key} cliffSeconds`).toBe("number");
      expect(typeof p.totalSeconds, `${key} totalSeconds`).toBe("number");
      expect(typeof p.isLumpSum, `${key} isLumpSum`).toBe("boolean");
    }
  });

  it("cliff < total for all presets with a cliff (Sablier requirement)", () => {
    for (const [key, p] of Object.entries(PRESETS)) {
      if (p.cliffSeconds > 0) {
        expect(p.cliffSeconds, `${key}: cliff must be < total`).toBeLessThan(
          p.totalSeconds,
        );
      }
    }
  });
});
