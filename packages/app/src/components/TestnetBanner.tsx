"use client";

import { IS_TESTNET } from "@/config/contracts";

export function TestnetBanner() {
  if (!IS_TESTNET) return null;

  return (
    <div className="bg-warning text-background text-center text-[11px] font-semibold py-1.5 px-4 tracking-[0.18em] uppercase tabular">
      Base Sepolia Testnet · No real funds · Get test ETH from{" "}
      <a
        href="https://www.alchemy.com/faucets/base-sepolia"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-background/40 hover:decoration-background underline-offset-2 transition-colors"
      >
        Alchemy Faucet
      </a>
    </div>
  );
}
