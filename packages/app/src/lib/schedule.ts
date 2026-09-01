/**
 * Schedule calculation utilities — pure functions used by the create page
 * and tested independently.
 */

export const DURATION_OPTIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "2 hours", seconds: 7200 },
  { label: "4 hours", seconds: 14400 },
  { label: "8 hours", seconds: 28800 },
  { label: "12 hours", seconds: 43200 },
  { label: "1 day", seconds: 86400 },
  { label: "3 days", seconds: 259200 },
  { label: "7 days", seconds: 604800 },
  { label: "14 days", seconds: 1209600 },
  { label: "30 days", seconds: 2592000 },
  { label: "60 days", seconds: 5184000 },
  { label: "90 days", seconds: 7776000 },
  { label: "180 days", seconds: 15552000 },
  { label: "365 days", seconds: 31536000 },
];

export const ALL_INTERVALS = [
  { label: "1hr", seconds: 3600 },
  { label: "2hr", seconds: 7200 },
  { label: "3hr", seconds: 10800 },
  { label: "6hr", seconds: 21600 },
  { label: "12hr", seconds: 43200 },
  { label: "24hr", seconds: 86400 },
  { label: "48hr", seconds: 172800 },
  { label: "7 days", seconds: 604800 },
  { label: "14 days", seconds: 1209600 },
  { label: "30 days", seconds: 2592000 },
];

/** Filter intervals that produce at least 2 claims for the given total */
export function getIntervalOptions(totalSeconds: number) {
  return ALL_INTERVALS.filter((i) => i.seconds <= totalSeconds / 2);
}

/** Parse a URL param into a positive duration (seconds), minimum 1 hour */
export function parsePositiveDurationParam(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 3600) return null;
  return parsed;
}

/** Parse a URL param into a valid USDC amount string. Decimal cap defaults to 6
 * (USDC on every EVM chain except BNB, which uses 18). */
export function parseAmountParam(value: string | null, decimals: number = 6): string {
  if (!value) return "";
  const re = new RegExp(`^(\\d+\\.?\\d{0,${decimals}}|\\d*\\.\\d{1,${decimals}})$`);
  return re.test(value) ? value : "";
}

/** Human-readable duration string */
export function formatDuration(seconds: number): string {
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (mins > 0) return `${hours}h ${mins}m`;
    return `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  if (days >= 365) return `${Math.floor(days / 365)}y ${days % 365}d`;
  return `${days}d`;
}

const SCALE = BigInt("1000000000000000000"); // 1e18

/** Compute broker fee from deposit amount */
export function computeFee(amount: bigint, brokerFee: bigint): bigint {
  if (brokerFee === BigInt(0)) return BigInt(0);
  return (amount * SCALE) / (SCALE - brokerFee) - amount;
}

/** Compute max deposit that fits within a wallet balance (after fee) */
export function computeMaxDeposit(walletBalance: bigint, brokerFee: bigint): bigint {
  return (walletBalance * (SCALE - brokerFee)) / SCALE;
}

/** Sablier requires cliff < total strictly. Smallest legal window is 1 hour. */
export const MIN_LOCK_SECONDS = 3600;

/**
 * Parse a value from an `<input type="datetime-local">` (format
 * "YYYY-MM-DDTHH:MM" in the browser's local timezone) into the unix ms
 * target and the seconds-from-now duration. Returns null when the input
 * is empty, malformed, or in the past / too soon.
 */
export function parseLockUntilInput(
  value: string,
  nowMs: number,
): { durationSeconds: number; targetMs: number } | null {
  if (!value) return null;
  const targetMs = new Date(value).getTime();
  if (!Number.isFinite(targetMs)) return null;
  const durationSeconds = Math.floor((targetMs - nowMs) / 1000);
  if (durationSeconds < MIN_LOCK_SECONDS) return null;
  return { durationSeconds, targetMs };
}

/** Pretty-print a unix ms timestamp as "Mon, Jun 1, 3:00 PM". */
export function formatTargetDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/**
 * Format a `Date` as a `datetime-local` input value
 * ("YYYY-MM-DDTHH:MM" in local time). Used to seed the picker with a
 * sensible default (e.g. one week out).
 */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ----------------------------------------------------------------------------
// Daily reloads (Lockup Tranched)
// ----------------------------------------------------------------------------

/** One Sablier tranche: `amount` unlocks `duration` seconds after the previous one. */
export interface TrancheWithDuration {
  amount: bigint;
  duration: number;
}

export const RELOAD_INTERVAL_SECONDS = 86400;

/**
 * If the picked time-of-day is closer than this, the first reload rolls to
 * tomorrow — a drop that lands moments after signing isn't a lock.
 */
export const MIN_FIRST_RELOAD_SECONDS = 900;

/** Sablier caps tranche count at 500; a year of daily drops stays under it. */
export const MAX_RELOAD_DAYS = 365;
export const MIN_RELOAD_DAYS = 2;

export const RELOAD_DAY_OPTIONS = [2, 3, 5, 7, 10, 14, 21, 30, 60, 90] as const;

/**
 * The net amount Sablier will actually stream after taking the broker fee
 * out of `totalAmount`. Replicates the contract's UD60x18 floor math —
 * tranche amounts must sum to exactly this or createWithDurationsLT reverts.
 */
export function sablierNetDeposit(totalAmount: bigint, brokerFee: bigint): bigint {
  return totalAmount - (totalAmount * brokerFee) / SCALE;
}

/**
 * Seconds from `nowMs` until the next local occurrence of "HH:MM". Rolls to
 * the following day when the next occurrence is sooner than
 * MIN_FIRST_RELOAD_SECONDS. Returns null for a malformed input.
 */
export function secondsUntilTimeOfDay(time: string, nowMs: number): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  const target = new Date(nowMs);
  target.setHours(hours, minutes, 0, 0);
  let delta = Math.floor((target.getTime() - nowMs) / 1000);
  if (delta < MIN_FIRST_RELOAD_SECONDS) delta += RELOAD_INTERVAL_SECONDS;
  return delta;
}

/**
 * Split `netDeposit` into `count` tranches: the first lands after
 * `firstDelaySeconds`, the rest every `intervalSeconds`. Integer dust from
 * the division is folded into the final tranche so the sum is exact.
 * Returns null when the inputs can't form a valid Sablier tranche list
 * (every tranche amount must be > 0).
 */
export function computeTranches(
  netDeposit: bigint,
  firstDelaySeconds: number,
  intervalSeconds: number,
  count: number,
): TrancheWithDuration[] | null {
  if (count < 1 || firstDelaySeconds < 1 || intervalSeconds < 1) return null;
  const n = BigInt(count);
  if (netDeposit < n) return null;
  const per = netDeposit / n;
  const last = netDeposit - per * (n - BigInt(1));
  return Array.from({ length: count }, (_, i) => ({
    amount: i === count - 1 ? last : per,
    duration: i === 0 ? firstDelaySeconds : intervalSeconds,
  }));
}

/** Calculate payout schedule for the vesting calculator display */
export function calculatePayoutSchedule(
  depositAmount: number,
  totalSeconds: number,
  cliffSeconds: number,
  intervalSeconds: number,
) {
  const vestSeconds = totalSeconds - cliffSeconds;
  const totalIntervals = vestSeconds > 0 ? Math.floor(vestSeconds / intervalSeconds) : 0;
  const perInterval = totalIntervals > 0 ? depositAmount / totalIntervals : 0;
  const pctPerInterval = totalIntervals > 0 ? 100 / totalIntervals : 0;

  return { totalIntervals, perInterval, pctPerInterval };
}
