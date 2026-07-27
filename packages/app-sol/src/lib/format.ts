/**
 * SOL amount + countdown display helpers, shared by /create and /vaults.
 *
 * All bigint string math — no floats — so lamport-exact values never pick
 * up binary rounding artifacts. Output must stay plain-decimal and
 * comma-free: the create page's Max button feeds `formatSol` output back
 * into `parseSolAmount`.
 */

import { SOL_DECIMALS } from "@/config/solsab";

export const LAMPORTS_PER_SOL = BigInt(1_000_000_000);

const AMOUNT_RE = new RegExp(`^\\d+(\\.\\d{1,${SOL_DECIMALS}})?$`);

/** Parse a user-typed SOL amount into lamports. Null when malformed or
 * more precise than 9 decimals. */
export function parseSolAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!AMOUNT_RE.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "000000000").slice(0, SOL_DECIMALS);
  try {
    return BigInt(whole) * LAMPORTS_PER_SOL + BigInt(padded);
  } catch {
    return null;
  }
}

/**
 * Format lamports for display. Shows up to 4 fractional digits (truncated,
 * never rounded up — a claimable balance must not overpromise) and trims
 * trailing zeros.
 *
 * Amounts under 0.0001 SOL fall back to two significant digits so a real
 * claimable drip never renders as a flat "0" — small locks on hourly
 * presets produce per-reload amounts well below the 4-decimal floor.
 */
export function formatSol(units: bigint): string {
  const whole = units / LAMPORTS_PER_SOL;
  const frac = units % LAMPORTS_PER_SOL;
  if (frac === 0n) return whole.toString();
  const padded = frac.toString().padStart(SOL_DECIMALS, "0");
  const trimmed = padded.slice(0, 4).replace(/0+$/, "");
  if (trimmed || whole !== 0n) {
    // Sub-0.0001 dust riding on a nonzero whole part stays truncated,
    // matching the EVM formatter's behavior for e.g. 1.00000005.
    return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
  }
  const firstNonzero = padded.search(/[1-9]/);
  const digits = padded.slice(0, firstNonzero + 2).replace(/0+$/, "");
  return `0.${digits}`;
}

/** Render seconds-until-next-unlock as a compact countdown. */
export function formatCountdown(seconds: bigint | null): string {
  if (seconds === null) return "—";
  if (seconds <= 0n) return "now";
  const s = Number(seconds);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
