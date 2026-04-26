/**
 * Treasury balance check — read-only across every mainnet chain in the registry.
 *
 *   pnpm balances              → checks the default treasury (per chains.ts)
 *   pnpm balances 0xAddr...    → checks any address (e.g. cold-storage sweep target)
 *
 * Uses each chain's default public RPC (no API key, no env config). One read
 * per chain via viem. Non-zero balances render in cyan; zeros are dim.
 *
 * Adding a chain to chains.ts auto-includes it here — there's no separate
 * list to maintain. Testnets are filtered out (they don't earn revenue).
 */

import { createPublicClient, formatUnits, getAddress, http, isAddress, type Address } from "viem";
import * as wagmiChains from "viem/chains";
import { CHAINS, type ChainConfig } from "../src/config/chains";

// Per-chain RPC overrides. viem's default for Ethereum (eth.merkle.io) gets
// rate-limited (HTTP 429) under back-to-back reads, so we keep a list of
// well-known public RPCs and walk them in order. Other chains' viem defaults
// have been fine in practice; add entries here only when one starts failing.
const RPC_FALLBACKS: Record<number, string[]> = {
  [wagmiChains.mainnet.id]: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://cloudflare-eth.com",
  ],
};

const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const chainIdToWagmiChain: Record<number, (typeof wagmiChains)[keyof typeof wagmiChains]> = {
  [wagmiChains.mainnet.id]: wagmiChains.mainnet,
  [wagmiChains.base.id]: wagmiChains.base,
  [wagmiChains.arbitrum.id]: wagmiChains.arbitrum,
  [wagmiChains.optimism.id]: wagmiChains.optimism,
  [wagmiChains.polygon.id]: wagmiChains.polygon,
  [wagmiChains.avalanche.id]: wagmiChains.avalanche,
  [wagmiChains.bsc.id]: wagmiChains.bsc,
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  cyan: useColor ? "\x1b[36m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  bold: useColor ? "\x1b[1m" : "",
  dim: useColor ? "\x1b[2m" : "",
  reset: useColor ? "\x1b[0m" : "",
};

type RpcAttempt = { url: string; ok: boolean; error?: string };

type Result = {
  chain: ChainConfig;
  balance: bigint;
  error: string | null;
  attempts: RpcAttempt[];
};

function shortMsg(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Collapse to single line — viem error messages carry URLs and multi-line
  // stack traces that would wreck the table layout.
  return msg.replace(/\s+/g, " ").trim().slice(0, 80);
}

function rpcsFor(chainId: number): string[] {
  if (RPC_FALLBACKS[chainId]) return RPC_FALLBACKS[chainId];
  const wagmiChain = chainIdToWagmiChain[chainId];
  return wagmiChain ? [wagmiChain.rpcUrls.default.http[0]] : [];
}

function shortHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function fetchBalance(chain: ChainConfig, address: Address): Promise<Result> {
  const wagmiChain = chainIdToWagmiChain[chain.chainId];
  if (!wagmiChain) {
    return { chain, balance: BigInt(0), error: "no RPC mapping", attempts: [] };
  }
  // Walk the candidate RPCs in order, recording each attempt so callers can
  // see which one served (and which failed silently behind a fallback).
  const urls = rpcsFor(chain.chainId);
  const attempts: RpcAttempt[] = [];
  for (const url of urls) {
    try {
      // Short timeout + no retries so a single slow public RPC (looking at you,
      // Ethereum) doesn't block the whole script.
      const client = createPublicClient({
        chain: wagmiChain,
        transport: http(url, { timeout: 8_000, retryCount: 0 }),
      });
      const balance = await client.readContract({
        address: chain.usdc,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      attempts.push({ url, ok: true });
      return { chain, balance, error: null, attempts };
    } catch (err) {
      attempts.push({ url, ok: false, error: shortMsg(err) });
    }
  }
  const lastError = attempts[attempts.length - 1]?.error ?? "no RPCs available";
  return { chain, balance: BigInt(0), error: lastError, attempts };
}

function resolveTargetAddress(): Address {
  const arg = process.argv[2];
  if (!arg) {
    // Default: the treasury currently set on the deployment's default chain.
    // (Same EOA across mainnet chains.)
    const defaultChain = Object.values(CHAINS).find((c) => !c.isTestnet);
    if (!defaultChain) {
      console.error("No mainnet chain in registry. Aborting.");
      process.exit(1);
    }
    return defaultChain.treasury;
  }
  if (!isAddress(arg)) {
    console.error(`"${arg}" isn't a valid EVM address.`);
    process.exit(1);
  }
  return getAddress(arg);
}

async function main() {
  const target = resolveTargetAddress();
  const mainnetChains = Object.values(CHAINS).filter((c) => !c.isTestnet);

  process.stdout.write(`\n  ${c.dim}Address${c.reset}  ${target}\n\n`);

  const results = await Promise.all(mainnetChains.map((chain) => fetchBalance(chain, target)));

  let totalDisplay = 0;
  for (const r of results) {
    const display = formatUnits(r.balance, r.chain.usdcDecimals);
    const num = Number(display);
    totalDisplay += num;

    const color = r.error ? c.dim : num > 0 ? c.cyan + c.bold : c.dim;
    const formatted = num > 0 ? num.toFixed(6) : "0.000000";
    const note = r.error ? ` ${c.dim}(${r.error})${c.reset}` : "";

    console.log(
      `  ${color}${r.chain.name.padEnd(14)}${c.reset} ${color}${formatted.padStart(14)} USDC${c.reset}${note}`
    );

    // Surface RPC failures even when a later fallback succeeded — these are
    // the silent failures the user wanted visibility on.
    const failed = r.attempts.filter((a) => !a.ok);
    const succeeded = r.attempts.find((a) => a.ok);
    for (const a of failed) {
      console.log(`  ${c.yellow}    ↳ ${shortHost(a.url)} failed: ${a.error}${c.reset}`);
    }
    if (failed.length > 0 && succeeded) {
      console.log(`  ${c.dim}    ↳ recovered via ${shortHost(succeeded.url)}${c.reset}`);
    }
  }

  const totalColor = totalDisplay > 0 ? c.cyan + c.bold : c.dim;
  console.log(`  ${c.dim}${"─".repeat(34)}${c.reset}`);
  console.log(
    `  ${totalColor}${"Total".padEnd(14)} ${totalDisplay.toFixed(6).padStart(14)} USDC${c.reset}\n`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
