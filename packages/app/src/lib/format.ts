import { formatUnits } from "viem";

/**
 * Format a token amount for display.
 *
 * `formatUnits` returns full precision — e.g. a streamed USDC balance reads
 * "33.333333" (6 dp) and a BNB-chain "USDC" balance can read 18 decimal
 * places. Nobody wants to see that on a card or a dashboard. This trims to a
 * sane number of fraction digits and adds thousands separators.
 *
 * Tiny non-zero amounts (smaller than the chosen precision) fall back to two
 * significant digits so a real, claimable drip never renders as a flat "0".
 */
export function formatTokenAmount(
  value: bigint,
  decimals: number,
  maxFractionDigits = 2
): string {
  const num = Number(formatUnits(value, decimals));
  if (num === 0) return "0";

  const smallest = 1 / 10 ** maxFractionDigits;
  if (num > 0 && num < smallest) {
    return num.toLocaleString("en-US", { maximumSignificantDigits: 2 });
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}
