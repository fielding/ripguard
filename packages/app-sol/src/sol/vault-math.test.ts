import { describe, it, expect } from "vitest";
import {
  streamStatus,
  streamedAmount,
  withdrawableAmount,
  streamProgress,
  secondsUntilNext,
  type StreamSnapshot,
} from "./vault-math";

const HOUR = 3600n;
const DAY = 86_400n;

// Locked-self RipGuard preset: 7-day daily payouts, no cliff, no front-load.
function dailyWeek(start = 1_700_000_000n): StreamSnapshot {
  return {
    startTime: start,
    cliffTime: 0n,
    endTime: start + 7n * DAY,
    deposited: 700_000_000n, // 700 USDC at 6 decimals
    startUnlock: 0n,
    cliffUnlock: 0n,
    withdrawn: 0n,
    refunded: 0n,
    isCancelable: false,
    isDepleted: false,
    wasCanceled: false,
  };
}

// Panic lock preset: 24h cliff, 24h+1s total. Effectively all-or-nothing
// after 24h.
function panicLock1d(start = 1_700_000_000n): StreamSnapshot {
  return {
    startTime: start,
    cliffTime: start + DAY,
    endTime: start + DAY + 1n,
    deposited: 100_000_000n,
    startUnlock: 0n,
    cliffUnlock: 0n,
    withdrawn: 0n,
    refunded: 0n,
    isCancelable: false,
    isDepleted: false,
    wasCanceled: false,
  };
}

describe("streamStatus", () => {
  it("Pending before start", () => {
    const s = dailyWeek();
    expect(streamStatus(s, s.startTime - 1n)).toBe("Pending");
  });

  it("Streaming during the linear window", () => {
    const s = dailyWeek();
    expect(streamStatus(s, s.startTime + DAY)).toBe("Streaming");
  });

  it("Settled at end exactly", () => {
    const s = dailyWeek();
    expect(streamStatus(s, s.endTime)).toBe("Settled");
  });

  it("Settled past end", () => {
    const s = dailyWeek();
    expect(streamStatus(s, s.endTime + DAY)).toBe("Settled");
  });

  it("Pending before cliff for cliff schedules", () => {
    const s = panicLock1d();
    expect(streamStatus(s, s.startTime + HOUR)).toBe("Pending");
    expect(streamStatus(s, s.cliffTime - 1n)).toBe("Pending");
  });

  it("Streaming once cliff passes", () => {
    const s = panicLock1d();
    expect(streamStatus(s, s.cliffTime)).toBe("Streaming");
  });

  it("Depleted overrides", () => {
    const s = { ...dailyWeek(), isDepleted: true };
    expect(streamStatus(s, s.endTime + DAY)).toBe("Depleted");
  });

  it("Canceled overrides Streaming", () => {
    const s = { ...dailyWeek(), wasCanceled: true };
    expect(streamStatus(s, s.startTime + DAY)).toBe("Canceled");
  });
});

describe("streamedAmount", () => {
  it("zero before start", () => {
    const s = dailyWeek();
    expect(streamedAmount(s, s.startTime - 1n)).toBe(0n);
  });

  it("exactly deposited at end", () => {
    const s = dailyWeek();
    expect(streamedAmount(s, s.endTime)).toBe(s.deposited);
  });

  it("deposited past end", () => {
    const s = dailyWeek();
    expect(streamedAmount(s, s.endTime + DAY)).toBe(s.deposited);
  });

  it("linearly proportional mid-stream — 1 day = 1/7 of total", () => {
    const s = dailyWeek();
    const oneDay = streamedAmount(s, s.startTime + DAY);
    expect(oneDay).toBe(s.deposited / 7n);
  });

  it("halfway = half deposited", () => {
    const s = dailyWeek();
    const half = streamedAmount(s, s.startTime + (s.endTime - s.startTime) / 2n);
    // floor division — 700e6 / 2 = 350e6 exactly
    expect(half).toBe(s.deposited / 2n);
  });

  it("zero before cliff for cliff schedules", () => {
    const s = panicLock1d();
    expect(streamedAmount(s, s.startTime + HOUR)).toBe(0n);
    expect(streamedAmount(s, s.cliffTime - 1n)).toBe(0n);
  });

  it("at cliff exactly, linear math kicks in (effectively zero accrual yet)", () => {
    const s = panicLock1d();
    // At the cliff timestamp, elapsed=0, so linearAccrued=0 too.
    expect(streamedAmount(s, s.cliffTime)).toBe(0n);
  });

  it("panic lock unlocks fully one second after cliff (end = cliff+1)", () => {
    const s = panicLock1d();
    expect(streamedAmount(s, s.endTime)).toBe(s.deposited);
  });

  it("respects startUnlock + cliffUnlock front-loads", () => {
    const s: StreamSnapshot = {
      ...dailyWeek(),
      cliffTime: 1_700_000_000n + DAY,
      startUnlock: 100_000_000n,
      cliffUnlock: 50_000_000n,
      deposited: 700_000_000n,
    };
    // Before start: 0
    expect(streamedAmount(s, s.startTime - 1n)).toBe(0n);
    // After start, before cliff: only startUnlock
    expect(streamedAmount(s, s.startTime + HOUR)).toBe(100_000_000n);
    // At cliff: startUnlock + cliffUnlock + 0 linear
    expect(streamedAmount(s, s.cliffTime)).toBe(150_000_000n);
    // At end: full deposited
    expect(streamedAmount(s, s.endTime)).toBe(700_000_000n);
  });
});

describe("withdrawableAmount", () => {
  it("equals streamed minus withdrawn", () => {
    const s: StreamSnapshot = {
      ...dailyWeek(),
      withdrawn: 50_000_000n,
    };
    const t = s.startTime + DAY; // streamed = 100 USDC
    expect(withdrawableAmount(s, t)).toBe(100_000_000n - 50_000_000n);
  });

  it("never negative", () => {
    const s: StreamSnapshot = {
      ...dailyWeek(),
      // withdrawn somehow exceeds streamed (shouldn't happen but check)
      withdrawn: 999_999_999_999n,
    };
    expect(withdrawableAmount(s, s.startTime + DAY)).toBe(0n);
  });

  it("zero when depleted", () => {
    const s: StreamSnapshot = { ...dailyWeek(), isDepleted: true };
    expect(withdrawableAmount(s, s.endTime)).toBe(0n);
  });
});

describe("streamProgress", () => {
  it("0 before start", () => {
    const s = dailyWeek();
    expect(streamProgress(s, s.startTime - 1n)).toBe(0);
  });

  it("1 after end", () => {
    const s = dailyWeek();
    expect(streamProgress(s, s.endTime + DAY)).toBe(1);
  });

  it("~0.5 halfway", () => {
    const s = dailyWeek();
    const halfway = s.startTime + (s.endTime - s.startTime) / 2n;
    expect(streamProgress(s, halfway)).toBeCloseTo(0.5, 4);
  });
});

describe("secondsUntilNext", () => {
  it("time until cliff while pending with cliff", () => {
    const s = panicLock1d();
    const t = s.startTime + HOUR;
    expect(secondsUntilNext(s, t)).toBe(s.cliffTime - t);
  });

  it("time until start while pending without cliff", () => {
    const s = dailyWeek();
    const t = s.startTime - 100n;
    expect(secondsUntilNext(s, t)).toBe(100n);
  });

  it("time until end while streaming", () => {
    const s = dailyWeek();
    const t = s.startTime + DAY;
    expect(secondsUntilNext(s, t)).toBe(s.endTime - t);
  });

  it("null when settled", () => {
    const s = dailyWeek();
    expect(secondsUntilNext(s, s.endTime + DAY)).toBeNull();
  });
});
