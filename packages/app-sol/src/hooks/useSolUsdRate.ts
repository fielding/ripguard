"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";

import {
  fetchSolUsdQuote,
  isSolUsdQuoteStale,
  type SolUsdQuote,
} from "@/lib/sol-usd";

export type SolUsdRate =
  | Readonly<{
      kind: "available";
      quote: SolUsdQuote;
      freshness: "live" | "stale";
    }>
  | Readonly<{ kind: "unavailable"; fetching: boolean }>;

export function useSolUsdRate(): SolUsdRate {
  const { connection } = useConnection();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ["pyth-sol-usd"],
    queryFn: () => fetchSolUsdQuote(connection),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (query.data === undefined) {
    return { kind: "unavailable", fetching: query.isFetching };
  }
  return {
    kind: "available",
    quote: query.data,
    freshness: isSolUsdQuoteStale(query.data, nowMs) ? "stale" : "live",
  };
}
