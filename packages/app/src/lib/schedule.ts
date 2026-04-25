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
