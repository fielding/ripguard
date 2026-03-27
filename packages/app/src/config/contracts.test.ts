import { describe, it, expect } from "vitest";
import { PRESETS, BROKER_FEE, SABLIER_LOCKUP, USDC_ADDRESS } from "./contracts";

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

describe("contract addresses", () => {
  it("SABLIER_LOCKUP is a valid address", () => {
    expect(SABLIER_LOCKUP).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("USDC_ADDRESS is a valid address", () => {
    expect(USDC_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

describe("BROKER_FEE", () => {
  it("is a bigint", () => {
    expect(typeof BROKER_FEE).toBe("bigint");
  });

  it("is <= 1% (1e16 in 1e18 scale)", () => {
    // Sanity check: fee should never be more than 1%
    expect(BROKER_FEE).toBeLessThanOrEqual(BigInt("10000000000000000"));
  });
});
