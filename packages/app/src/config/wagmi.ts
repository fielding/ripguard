import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import * as wagmiChains from "wagmi/chains";
import { type Chain } from "wagmi/chains";
import { CHAINS } from "./chains";

// Map a registry chainId to its wagmi chain definition. Add an entry here
// when adding a chain to the registry so wagmi can pick it up.
const chainIdToWagmiChain: Record<number, Chain> = {
  [wagmiChains.base.id]: wagmiChains.base,
  [wagmiChains.baseSepolia.id]: wagmiChains.baseSepolia,
};

const isTestnet = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia";

// Derive wagmi's chain list from the registry, filtered to chains matching
// the deployment's testnet flag. Registry ⇒ wagmi is one-way: adding a
// chain to chains.ts (with a corresponding wagmi mapping above) auto-expands
// the wallet picker.
const supportedChains = Object.values(CHAINS)
  .filter((c) => c.isTestnet === isTestnet)
  .map((c) => chainIdToWagmiChain[c.chainId])
  .filter((c): c is Chain => c !== undefined);

if (supportedChains.length === 0) {
  throw new Error(
    `No wagmi-mapped chains for ${isTestnet ? "testnet" : "mainnet"} deployment. Check chains.ts and the chainIdToWagmiChain map in wagmi.ts.`
  );
}

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
if (!wcProjectId && process.env.NODE_ENV === "development") {
  console.warn(
    "[RipGuard] NEXT_PUBLIC_WC_PROJECT_ID is not set — wallet connections may fail."
  );
}

export const config = getDefaultConfig({
  appName: "RipGuard",
  projectId: wcProjectId || "YOUR_WC_PROJECT_ID",
  chains: supportedChains as [Chain, ...Chain[]],
  ssr: true,
});
