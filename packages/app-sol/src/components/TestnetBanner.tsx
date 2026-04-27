"use client";

import { IS_DEVNET } from "@/config/solsab";

export function TestnetBanner() {
  if (!IS_DEVNET) return null;

  return (
    <div className="bg-warning text-background text-center text-[11px] font-semibold py-1.5 px-4 tracking-[0.18em] uppercase tabular">
      Solana Devnet · No real funds · Get devnet SOL from{" "}
      <a
        href="https://faucet.solana.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-background/40 hover:decoration-background underline-offset-2 transition-colors"
      >
        Solana Faucet
      </a>
    </div>
  );
}
