import { describe, it, expect } from "vitest";
import {
  formatDuration,
  parsePositiveDurationParam,
  parseAmountParam,
  getIntervalOptions,
  computeFee,
  computeMaxDeposit,
  calculatePayoutSchedule,
  DURATION_OPTIONS,
  ALL_INTERVALS,
} from "./schedule";

// --- formatDuration ---

describe("formatDuration", () => {
  it("formats hours", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(7200)).toBe("2h");
    expect(formatDuration(14400)).toBe("4h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(5400)).toBe("1h 30m");
    expect(formatDuration(3601)).toBe("1h"); // 1 second past the hour, 0 mins omitted
  });

  it("formats days", () => {
    expect(formatDuration(86400)).toBe("1d");
    expect(formatDuration(172800)).toBe("2d");
    expect(formatDuration(604800)).toBe("7d");
    expect(formatDuration(2592000)).toBe("30d");
  });

  it("formats years and days", () => {
    expect(formatDuration(31536000)).toBe("1y 0d");
    expect(formatDuration(31536000 + 86400)).toBe("1y 1d");
    expect(formatDuration(31536000 * 2 + 86400 * 30)).toBe("2y 30d");
  });

  it("handles zero and edge cases", () => {
    expect(formatDuration(0)).toBe("0h");
    expect(formatDuration(59)).toBe("0h"); // less than a minute, 0 mins omitted
    expect(formatDuration(60)).toBe("0h 1m");
  });
});

// --- parsePositiveDurationParam ---

describe("parsePositiveDurationParam", () => {
  it("returns null for empty/null", () => {
    expect(parsePositiveDurationParam(null)).toBeNull();
    expect(parsePositiveDurationParam("")).toBeNull();
  });

  it("returns null for values below 1 hour", () => {
    expect(parsePositiveDurationParam("3599")).toBeNull();
    expect(parsePositiveDurationParam("0")).toBeNull();
    expect(parsePositiveDurationParam("-1")).toBeNull();
  });

  it("returns null for non-integers", () => {
    expect(parsePositiveDurationParam("3600.5")).toBeNull();
    expect(parsePositiveDurationParam("abc")).toBeNull();
  });

  it("parses valid durations", () => {
    expect(parsePositiveDurationParam("3600")).toBe(3600);
    expect(parsePositiveDurationParam("86400")).toBe(86400);
    expect(parsePositiveDurationParam("604800")).toBe(604800);
  });
});

// --- parseAmountParam ---

describe("parseAmountParam", () => {
  it("returns empty string for null/empty", () => {
    expect(parseAmountParam(null)).toBe("");
    expect(parseAmountParam("")).toBe("");
  });

  it("rejects invalid amounts", () => {
    expect(parseAmountParam("abc")).toBe("");
    expect(parseAmountParam("-100")).toBe("");
    expect(parseAmountParam("1.1234567")).toBe(""); // 7 decimals, max is 6
  });

  it("accepts valid amounts", () => {
    expect(parseAmountParam("100")).toBe("100");
    expect(parseAmountParam("100.50")).toBe("100.50");
    expect(parseAmountParam("0.000001")).toBe("0.000001"); // 6 decimals
    expect(parseAmountParam(".5")).toBe(".5");
    expect(parseAmountParam("1000000")).toBe("1000000");
  });
});

// --- getIntervalOptions ---

describe("getIntervalOptions", () => {
  it("returns empty for very short durations", () => {
    expect(getIntervalOptions(3600)).toEqual([]); // 1hr total, no interval fits 2x
    expect(getIntervalOptions(7199)).toEqual([]); // just under 2hr
  });

  it("returns 1hr for 2hr+ total", () => {
    const opts = getIntervalOptions(7200);
    expect(opts).toHaveLength(1);
    expect(opts[0].label).toBe("1hr");
  });

  it("returns hourly options for 1 day total", () => {
    const opts = getIntervalOptions(86400);
    const labels = opts.map((o) => o.label);
    expect(labels).toContain("1hr");
    expect(labels).toContain("2hr");
    expect(labels).toContain("3hr");
    expect(labels).toContain("6hr");
    expect(labels).toContain("12hr");
    expect(labels).not.toContain("24hr"); // 24hr = total, only 1 claim
  });

  it("returns daily+ options for 7 day total", () => {
    const opts = getIntervalOptions(604800);
    const labels = opts.map((o) => o.label);
    expect(labels).toContain("1hr");
    expect(labels).toContain("24hr");
    expect(labels).toContain("48hr");
    expect(labels).not.toContain("7 days"); // equals total
  });

  it("returns long intervals for 90 day total", () => {
    const opts = getIntervalOptions(7776000);
    const labels = opts.map((o) => o.label);
    expect(labels).toContain("30 days");
    expect(labels).toContain("14 days");
    expect(labels).toContain("7 days");
  });
});

// --- computeFee ---

describe("computeFee", () => {
  const BROKER_FEE = BigInt("5000000000000000"); // 0.5%

  it("returns 0 when fee is 0", () => {
    expect(computeFee(BigInt(1000000), BigInt(0))).toBe(BigInt(0));
  });

  it("returns 0 for zero deposit", () => {
    expect(computeFee(BigInt(0), BROKER_FEE)).toBe(BigInt(0));
  });

  it("computes ~0.5% fee for standard deposit", () => {
    const deposit = BigInt(1000_000_000); // 1000 USDC (6 decimals)
    const fee = computeFee(deposit, BROKER_FEE);
    // 0.5% of 1000 = 5 USDC = 5_000_000
    // Due to rounding in fixed-point math, should be very close
    expect(Number(fee)).toBeGreaterThanOrEqual(5_000_000);
    expect(Number(fee)).toBeLessThanOrEqual(5_100_000);
  });

  it("fee + deposit = totalAmount that Sablier receives", () => {
    const deposit = BigInt(100_000_000); // 100 USDC
    const fee = computeFee(deposit, BROKER_FEE);
    const total = deposit + fee;
    // Verify: deposit should be ~99.5% of total
    const pct = (Number(deposit) / Number(total)) * 100;
    expect(pct).toBeCloseTo(99.5, 1);
  });
});

// --- computeMaxDeposit ---

describe("computeMaxDeposit", () => {
  const BROKER_FEE = BigInt("5000000000000000"); // 0.5%

  it("max deposit + fee should not exceed balance", () => {
    const balance = BigInt(1000_000_000); // 1000 USDC
    const maxDeposit = computeMaxDeposit(balance, BROKER_FEE);
    const fee = computeFee(maxDeposit, BROKER_FEE);
    expect(maxDeposit + fee).toBeLessThanOrEqual(balance);
  });

  it("returns full balance when fee is 0", () => {
    const balance = BigInt(1000_000_000);
    expect(computeMaxDeposit(balance, BigInt(0))).toBe(balance);
  });

  it("returns 0 for zero balance", () => {
    expect(computeMaxDeposit(BigInt(0), BROKER_FEE)).toBe(BigInt(0));
  });
});

// --- calculatePayoutSchedule ---

describe("calculatePayoutSchedule", () => {
  it("calculates hourly payouts for 1 day", () => {
    const result = calculatePayoutSchedule(10000, 86400, 0, 3600);
    expect(result.totalIntervals).toBe(24);
    expect(result.perInterval).toBeCloseTo(416.67, 1);
    expect(result.pctPerInterval).toBeCloseTo(4.167, 1);
  });

  it("calculates hourly payouts for 3 days", () => {
    const result = calculatePayoutSchedule(10000, 259200, 0, 3600);
    expect(result.totalIntervals).toBe(72);
    expect(result.perInterval).toBeCloseTo(138.89, 1);
    expect(result.pctPerInterval).toBeCloseTo(1.389, 1);
  });

  it("accounts for cliff in payout calculation", () => {
    // 1 day cliff + 7 day vest, daily interval
    const result = calculatePayoutSchedule(10000, 8 * 86400, 86400, 86400);
    expect(result.totalIntervals).toBe(7); // 7 days of vesting after cliff
    expect(result.perInterval).toBeCloseTo(1428.57, 0);
  });

  it("returns 0 payouts when total equals cliff", () => {
    const result = calculatePayoutSchedule(10000, 86400, 86400, 3600);
    expect(result.totalIntervals).toBe(0);
    expect(result.perInterval).toBe(0);
  });

  it("handles zero deposit", () => {
    const result = calculatePayoutSchedule(0, 86400, 0, 3600);
    expect(result.totalIntervals).toBe(24);
    expect(result.perInterval).toBe(0);
  });
});

// --- Data integrity ---

describe("DURATION_OPTIONS", () => {
  it("is sorted by seconds ascending", () => {
    for (let i = 1; i < DURATION_OPTIONS.length; i++) {
      expect(DURATION_OPTIONS[i].seconds).toBeGreaterThan(DURATION_OPTIONS[i - 1].seconds);
    }
  });

  it("starts at 1 hour", () => {
    expect(DURATION_OPTIONS[0].seconds).toBe(3600);
  });
});

describe("ALL_INTERVALS", () => {
  it("is sorted by seconds ascending", () => {
    for (let i = 1; i < ALL_INTERVALS.length; i++) {
      expect(ALL_INTERVALS[i].seconds).toBeGreaterThan(ALL_INTERVALS[i - 1].seconds);
    }
  });

  it("starts at 1 hour", () => {
    expect(ALL_INTERVALS[0].seconds).toBe(3600);
  });
});
