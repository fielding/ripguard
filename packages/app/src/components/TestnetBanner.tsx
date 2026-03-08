"use client";

import { IS_TESTNET } from "@/config/contracts";

export function TestnetBanner() {
  if (!IS_TESTNET) return null;

  return (
    <div className="bg-yellow-500/90 text-black text-center text-xs font-bold py-1.5 px-4 tracking-wider uppercase">
      Base Sepolia Testnet &mdash; No real funds. Get test ETH from{" "}
      <a
        href="https://www.alchemy.com/faucets/base-sepolia"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Alchemy Faucet
      </a>
    </div>
  );
}
