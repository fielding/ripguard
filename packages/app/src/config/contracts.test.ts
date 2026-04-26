import { describe, it, expect } from "vitest";
import {
  PRESETS,
  BROKER_FEE_RATE,
  brokerFeeForTreasury,
  brokerFeePctString,
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
