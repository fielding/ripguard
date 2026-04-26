"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { CHAINS, isSupportedDeploymentChain } from "@/config/chains";
import { IS_TESTNET } from "@/config/contracts";

/** Renders a "switch chain" prompt when the wallet is on a chain RipGuard
 *  doesn't support yet. Returns null when the chain is supported, so the
 *  caller can wrap their page content like:
 *
 *  ```tsx
 *  <WrongChainPanel>{normalContent}</WrongChainPanel>
 *  ```
 */
export function WrongChainPanel({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  // Check against the active deployment specifically, not just registry
  // membership — Base Sepolia is in the registry, but on the mainnet
  // deployment it's still "wrong chain" for our purposes.
  if (isSupportedDeploymentChain(chainId, IS_TESTNET)) {
    return <>{children}</>;
  }

  const supportedForDeployment = Object.values(CHAINS).filter(
    (c) => c.isTestnet === IS_TESTNET
  );

  return (
    <div className="flex flex-col items-center justify-center gap-7 py-16 px-6 text-center max-w-md mx-auto">
      <div className="eyebrow text-warning/90">Wrong network</div>
      <h3 className="font-display text-3xl tracking-tight max-w-sm">
        Your wallet is on a chain we don&apos;t support yet.
      </h3>
      <p className="text-muted text-sm leading-relaxed max-w-sm">
        RipGuard runs on{" "}
        {supportedForDeployment.map((c, i) => (
          <span key={c.chainId}>
            {i > 0 && i === supportedForDeployment.length - 1 ? " and " : i > 0 ? ", " : ""}
            <span className="text-foreground">{c.name}</span>
          </span>
        ))}
        . Switch your wallet to lock USDC.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        {supportedForDeployment.map((c) => (
          <button
            key={c.chainId}
            onClick={() => switchChain({ chainId: c.chainId })}
            disabled={isPending}
            className="btn-primary disabled:opacity-50"
          >
            {isPending ? "Confirm in wallet…" : `Switch to ${c.shortName}`}
          </button>
        ))}
      </div>
    </div>
  );
}
