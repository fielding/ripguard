import { describe, it, expect } from "vitest";
import {
  LAMPORTS_PER_SOL,
  parseSolAmount,
  formatSol,
  formatCountdown,
} from "./format";

const sol = (n: number) => BigInt(Math.round(n * 1e9));

describe("parseSolAmount", () => {
  it("returns null for empty or whitespace input", () => {
    expect(parseSolAmount("")).toBeNull();
    expect(parseSolAmount("   ")).toBeNull();
  });

  it("parses whole SOL amounts", () => {
    expect(parseSolAmount("1")).toBe(LAMPORTS_PER_SOL);
    expect(parseSolAmount("25")).toBe(25n * LAMPORTS_PER_SOL);
    expect(parseSolAmount("0")).toBe(0n);
  });

  it("parses fractional amounts to exact lamports", () => {
    expect(parseSolAmount("0.5")).toBe(500_000_000n);
    expect(parseSolAmount("1.000000001")).toBe(1_000_000_001n);
    expect(parseSolAmount("0.000000001")).toBe(1n);
  });

  it("trims surrounding whitespace", () => {
    expect(parseSolAmount("  1.5  ")).toBe(1_500_000_000n);
  });

  it("rejects malformed input", () => {
    expect(parseSolAmount("1.")).toBeNull();
    expect(parseSolAmount(".5")).toBeNull();
    expect(parseSolAmount("1,000")).toBeNull();
    expect(parseSolAmount("-1")).toBeNull();
    expect(parseSolAmount("1e9")).toBeNull();
    expect(parseSolAmount("abc")).toBeNull();
    expect(parseSolAmount("1.2.3")).toBeNull();
  });

  it("rejects more than 9 decimal places", () => {
    expect(parseSolAmount("1.0000000001")).toBeNull();
  });
});

describe("formatSol", () => {
  it("formats zero and whole amounts without decimals", () => {
    expect(formatSol(0n)).toBe("0");
    expect(formatSol(LAMPORTS_PER_SOL)).toBe("1");
    expect(formatSol(25n * LAMPORTS_PER_SOL)).toBe("25");
  });

  it("shows up to 4 fractional digits, trimming trailing zeros", () => {
    expect(formatSol(sol(0.5))).toBe("0.5");
    expect(formatSol(sol(1.25))).toBe("1.25");
    expect(formatSol(sol(0.1234))).toBe("0.1234");
    expect(formatSol(sol(3.1))).toBe("3.1");
  });

  it("truncates past 4 digits instead of rounding up", () => {
    // A claimable balance must never overpromise.
    expect(formatSol(sol(0.99999))).toBe("0.9999");
    expect(formatSol(sol(1.23456))).toBe("1.2345");
  });

  it("drops sub-0.0001 dust riding on a nonzero whole part", () => {
    expect(formatSol(LAMPORTS_PER_SOL + 50n)).toBe("1");
  });

  it("never renders a real sub-0.0001 amount as flat 0", () => {
    // 0.01 SOL on the hourly-1-week preset drips ~0.0000595 per reload.
    expect(formatSol(59_500n)).toBe("0.000059");
    expect(formatSol(10_000n)).toBe("0.00001");
    expect(formatSol(1n)).toBe("0.000000001");
    expect(formatSol(999n)).toBe("0.00000099");
  });

  it("emits no thousands separators (Max feeds output back into parseSolAmount)", () => {
    expect(formatSol(1_234_567n * LAMPORTS_PER_SOL)).toBe("1234567");
  });

  it("round-trips through parseSolAmount without ever growing", () => {
    // The Max button does setAmountStr(formatSol(max)); the re-parsed
    // value must be valid and must not exceed the original.
    const cases = [
      0n,
      1n,
      999n,
      10_000n,
      59_500n,
      sol(0.5),
      sol(0.99999),
      LAMPORTS_PER_SOL + 50n,
      123n * LAMPORTS_PER_SOL + 456_789_123n,
    ];
    for (const units of cases) {
      const parsed = parseSolAmount(formatSol(units));
      expect(parsed).not.toBeNull();
      expect(parsed! <= units).toBe(true);
    }
  });
});

describe("formatCountdown", () => {
  it("renders em dash for unknown", () => {
    expect(formatCountdown(null)).toBe("—");
  });

  it("renders now at or past zero", () => {
    expect(formatCountdown(0n)).toBe("now");
    expect(formatCountdown(-5n)).toBe("now");
  });

  it("renders seconds only under a minute", () => {
    expect(formatCountdown(45n)).toBe("45s");
  });

  it("renders minutes and seconds under an hour", () => {
    expect(formatCountdown(90n)).toBe("1m 30s");
  });

  it("renders hours and minutes under a day", () => {
    expect(formatCountdown(3_700n)).toBe("1h 1m");
  });

  it("renders days and hours past a day", () => {
    expect(formatCountdown(90_061n)).toBe("1d 1h");
  });
});
