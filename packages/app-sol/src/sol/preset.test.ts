import { describe, it, expect } from "vitest";
import { presetToSolanaArgs, customScheduleToSolanaArgs } from "./preset";
import { PRESETS } from "@/config/solsab";

describe("presetToSolanaArgs", () => {
  it("translates every PRESETS entry without throwing", () => {
    for (const key of Object.keys(PRESETS) as Array<keyof typeof PRESETS>) {
      const args = presetToSolanaArgs(key);
      expect(args.cliffSeconds, `${key} cliffSeconds`).toBe(
        PRESETS[key].cliffSeconds,
      );
      expect(args.totalSeconds, `${key} totalSeconds`).toBe(
        PRESETS[key].totalSeconds,
      );
      expect(args.isCancelable).toBe(false);
      expect(args.startUnlockAmount).toBe(0n);
      expect(args.cliffUnlockAmount).toBe(0n);
    }
  });

  it("hourly1d → no cliff, 24h total, non-cancelable", () => {
    const args = presetToSolanaArgs("hourly1d");
    expect(args.cliffSeconds).toBe(0);
    expect(args.totalSeconds).toBe(86_400);
    expect(args.isCancelable).toBe(false);
  });

  it("panicLock1d → 24h cliff, 24h+1s total (Sablier cliff < total)", () => {
    const args = presetToSolanaArgs("panicLock1d");
    expect(args.cliffSeconds).toBe(86_400);
    expect(args.totalSeconds).toBe(86_401);
    expect(args.cliffSeconds).toBeLessThan(args.totalSeconds);
  });

  it("panicThenDaily → 1-day cliff before 8-day total", () => {
    const args = presetToSolanaArgs("panicThenDaily");
    expect(args.cliffSeconds).toBe(86_400);
    expect(args.totalSeconds).toBe(8 * 86_400);
  });
});

describe("customScheduleToSolanaArgs", () => {
  it("accepts a no-cliff schedule", () => {
    const args = customScheduleToSolanaArgs({
      cliffSeconds: 0,
      totalSeconds: 7 * 86_400,
    });
    expect(args.cliffSeconds).toBe(0);
    expect(args.totalSeconds).toBe(7 * 86_400);
    expect(args.isCancelable).toBe(false);
  });

  it("accepts a valid cliff schedule", () => {
    const args = customScheduleToSolanaArgs({
      cliffSeconds: 3600,
      totalSeconds: 7200,
    });
    expect(args.cliffSeconds).toBe(3600);
    expect(args.totalSeconds).toBe(7200);
  });

  it("rejects totalSeconds <= 0", () => {
    expect(() =>
      customScheduleToSolanaArgs({ cliffSeconds: 0, totalSeconds: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      customScheduleToSolanaArgs({ cliffSeconds: 0, totalSeconds: -1 }),
    ).toThrow(RangeError);
  });

  it("rejects negative cliffSeconds", () => {
    expect(() =>
      customScheduleToSolanaArgs({ cliffSeconds: -1, totalSeconds: 100 }),
    ).toThrow(RangeError);
  });

  it("rejects cliff >= total (Sablier requirement)", () => {
    expect(() =>
      customScheduleToSolanaArgs({ cliffSeconds: 100, totalSeconds: 100 }),
    ).toThrow(RangeError);
    expect(() =>
      customScheduleToSolanaArgs({ cliffSeconds: 200, totalSeconds: 100 }),
    ).toThrow(RangeError);
  });

  it("allows cliffSeconds = totalSeconds - 1", () => {
    const args = customScheduleToSolanaArgs({
      cliffSeconds: 99,
      totalSeconds: 100,
    });
    expect(args.cliffSeconds).toBe(99);
    expect(args.totalSeconds).toBe(100);
  });
});
