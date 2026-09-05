import { getDefaultConfig, getDefaultWallets } from "@rainbow-me/rainbowkit";
import { phantomWallet } from "@rainbow-me/rainbowkit/wallets";
import * as wagmiChains from "wagmi/chains";
import { type Chain } from "wagmi/chains";
import { fallback, http, type Transport } from "viem";
import { CHAINS, DEPLOYMENT_CHAINS } from "./chains";
import { IS_TESTNET } from "./contracts";

// Map a registry chainId to its wagmi chain definition. Add an entry here
// when adding a chain to the registry so wagmi can pick it up.
const chainIdToWagmiChain: Record<number, Chain> = {
  [wagmiChains.mainnet.id]: wagmiChains.mainnet,
  [wagmiChains.base.id]: wagmiChains.base,
  [wagmiChains.arbitrum.id]: wagmiChains.arbitrum,
  [wagmiChains.optimism.id]: wagmiChains.optimism,
  [wagmiChains.polygon.id]: wagmiChains.polygon,
  [wagmiChains.avalanche.id]: wagmiChains.avalanche,
  [wagmiChains.bsc.id]: wagmiChains.bsc,
  [wagmiChains.baseSepolia.id]: wagmiChains.baseSepolia,
};

// Derive wagmi's chain list from the registry. Registry ⇒ wagmi is one-way:
// adding a chain to chains.ts (with a corresponding wagmi mapping above)
// auto-expands the wallet picker.
const supportedChains = DEPLOYMENT_CHAINS
  .map((c) => chainIdToWagmiChain[c.chainId])
  .filter((c): c is Chain => c !== undefined);

if (supportedChains.length === 0) {
  throw new Error(
    `No wagmi-mapped chains for ${IS_TESTNET ? "testnet" : "mainnet"} deployment. Check chains.ts and the chainIdToWagmiChain map in wagmi.ts.`
  );
}

// Explicit per-chain transports from the registry's vetted RPC lists.
// Without this wagmi silently uses viem's built-in default RPC for every
// chain — including for the mainnet ENS lookups RainbowKit runs on every
// page whenever chain 1 is configured. `fallback` gives each inner http()
// zero retries and rotates to the next URL on a transport failure, so one
// throttled public endpoint degrades to the next instead of surfacing.
const transports: Record<number, Transport> = {};
for (const chain of supportedChains) {
  transports[chain.id] = fallback(CHAINS[chain.id].rpcUrls.map((url) => http(url)));
}

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
if (!wcProjectId && process.env.NODE_ENV === "development") {
  console.warn(
    "[RipGuard] NEXT_PUBLIC_WC_PROJECT_ID is not set — wallet connections may fail."
  );
}

// RainbowKit's default list (Rainbow, Coinbase, MetaMask, WalletConnect)
// omits Phantom, so Phantom-first users only got flaky EIP-6963 detection
// and no mobile deep-link. Append it explicitly.
const { wallets: defaultWallets } = getDefaultWallets();
defaultWallets[0]?.wallets.push(phantomWallet);

export const config = getDefaultConfig({
  appName: "RipGuard",
  projectId: wcProjectId || "YOUR_WC_PROJECT_ID",
  chains: supportedChains as [Chain, ...Chain[]],
  transports,
  wallets: defaultWallets,
  ssr: true,
});
