"use client";

import { formatUsdEstimate } from "@/lib/sol-usd";
import type { SolUsdRate } from "@/hooks/useSolUsdRate";

interface UsdEstimateProps {
  lamports: bigint;
  rate: SolUsdRate;
  className?: string;
}

/** Secondary estimate only. SOL always remains the primary amount. */
export function UsdEstimate({
  lamports,
  rate,
  className = "text-faint",
}: UsdEstimateProps) {
  return (
    <span className={`tabular whitespace-nowrap ${className}`}>
      ≈ {rate.kind === "available" ? formatUsdEstimate(lamports, rate.quote) : "$—"}
    </span>
  );
}

export function SolUsdSource({ rate }: { rate: SolUsdRate }) {
  if (rate.kind === "unavailable") {
    return (
      <div
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint tabular"
        aria-live="polite"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-faint" aria-hidden="true" />
        Pyth · {rate.fetching ? "fetching USD" : "USD unavailable"}
      </div>
    );
  }

  const fetchedAt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(rate.quote.fetchedAtMs);
  const stale = rate.freshness === "stale";

  return (
    <div
      className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] tabular ${
        stale
          ? "border-line text-faint"
          : "border-cyan/25 bg-cyan/[0.04] text-muted"
      }`}
      title={`Pyth SOL/USD fetched at ${fetchedAt}`}
      aria-live="polite"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${stale ? "bg-faint" : "bg-cyan"}`}
        aria-hidden="true"
      />
      Pyth · fetched {fetchedAt} · {stale ? "stale" : "live"}
    </div>
  );
}
