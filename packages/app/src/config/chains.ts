import { type Address } from "viem";

export type ChainConfig = {
  chainId: number;
  name: string;
  shortName: string;
  sablierLockup: Address;
  usdc: Address;
  usdcDecimals: number;
  treasury: Address;
  explorerUrl: string;
  // Brand name of the explorer at explorerUrl, used as link/button copy.
  // "View on BaseScan" reads stronger than a generic "View on the explorer"
  // and is correct per chain (Etherscan, Arbiscan, etc.).
  explorerName: string;
  // Ordered JSON-RPC endpoints for wagmi's public client: first is primary,
  // the rest are fallbacks. Never leave a chain on viem's built-in default —
  // those are unvetted third parties, and Ethereum's (eth.merkle.io) started
  // rejecting CORS preflight, which broke ENS and every mainnet read in the
  // browser. Each URL below was checked for a permissive preflight from
  // ripguard.xyz; re-check before adding one.
  rpcUrls: readonly string[];
  isTestnet: boolean;
  // Optional disclosure shown in /create and /vaults when this chain is
  // active. Used today to flag that BNB Chain "USDC" is Binance-Peg, not
  // Circle-native — a real distinction users should know about.
  usdcNote?: string;
};

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

// Treasury — same EOA on every EVM chain (EVM addresses derive from public
// keys, so a single private key gives the same address everywhere). EIP-7702
// delegations are per-chain and don't change the underlying account.
const TREASURY_EOA: Address = "0x847F640bE052b0700C31F72Dce622F4C6286934E";

const ETHEREUM_DEFAULT: ChainConfig = {
  chainId: 1,
  name: "Ethereum",
  shortName: "Ethereum",
  sablierLockup: "0x7C01AA3783577E15fD7e272443D44B92d5b21056",
  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  usdcDecimals: 6,
  treasury: TREASURY_EOA,
  explorerUrl: "https://etherscan.io",
  explorerName: "Etherscan",
  rpcUrls: [
    "https://ethereum-rpc.publicnode.com",
    "https://cloudflare-eth.com",
    "https://eth.drpc.org",
  ],
  isTestnet: false,
};

const BASE_DEFAULT: ChainConfig = {
  chainId: 8453,
  name: "Base",
  shortName: "Base",
  sablierLockup: "0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  usdcDecimals: 6,
  treasury: TREASURY_EOA,
  explorerUrl: "https://basescan.org",
  explorerName: "BaseScan",
  rpcUrls: [
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
    "https://base.drpc.org",
  ],
  isTestnet: false,
};

const ARBITRUM_DEFAULT: ChainConfig = {
  chainId: 42161,
  name: "Arbitrum One",
  shortName: "Arbitrum",
  sablierLockup: "0x467D5Bf8Cfa1a5f99328fBdCb9C751c78934b725",
  usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // native USDC, not USDC.e
  usdcDecimals: 6,
  treasury: TREASURY_EOA,
  explorerUrl: "https://arbiscan.io",
  explorerName: "Arbiscan",
  rpcUrls: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one-rpc.publicnode.com",
    "https://arbitrum.drpc.org",
  ],
  isTestnet: false,
};

const OPTIMISM_DEFAULT: ChainConfig = {
  chainId: 10,
  name: "Optimism",
  shortName: "Optimism",
  sablierLockup: "0x822e9c4852E978104d82F0f785bFA663c2b700c1",
  usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // native USDC
  usdcDecimals: 6,
  treasury: TREASURY_EOA,
  explorerUrl: "https://optimistic.etherscan.io",
  explorerName: "Optimistic Etherscan",
  rpcUrls: [
    "https://mainnet.optimism.io",
    "https://optimism-rpc.publicnode.com",
    "https://optimism.drpc.org",
  ],
  isTestnet: false,
};

const POLYGON_DEFAULT: ChainConfig = {
  chainId: 137,
  name: "Polygon",
  shortName: "Polygon",
  sablierLockup: "0xE0BFe071Da104e571298f8b6e0fcE44C512C1Ff4",
  usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // native USDC, not USDC.e
  usdcDecimals: 6,
  treasury: TREASURY_EOA,
  explorerUrl: "https://polygonscan.com",
  explorerName: "PolygonScan",
  rpcUrls: [
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon.drpc.org",
  ],
  isTestnet: false,
};

const AVALANCHE_DEFAULT: ChainConfig = {
  chainId: 43114,
  name: "Avalanche",
  shortName: "Avalanche",
  sablierLockup: "0x3C81BBBe72EF8eF3fb1D19B0bd6310Ad0dd27E82",
  usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  usdcDecimals: 6,
  treasury: TREASURY_EOA,
  explorerUrl: "https://snowtrace.io",
  explorerName: "Snowtrace",
  rpcUrls: [
    "https://api.avax.network/ext/bc/C/rpc",
    "https://avalanche-c-chain-rpc.publicnode.com",
  ],
  isTestnet: false,
};

// BNB Smart Chain — note that "USDC" here is Binance-Peg (18 decimals, not 6).
// Circle does not issue native USDC on BNB Chain. The token is custodied by
// Binance and bridged. We support it for utility (casino degens cash out here)
// but disclose the distinction in the UI via usdcNote.
const BSC_DEFAULT: ChainConfig = {
  chainId: 56,
  name: "BNB Chain",
  shortName: "BNB",
  sablierLockup: "0x6E0baD2c077d699841F1929b45bfb93FAfBEd395",
  usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // Binance-Peg USDC
  usdcDecimals: 18, // not 6 — sharp edge
  treasury: TREASURY_EOA,
  explorerUrl: "https://bscscan.com",
  explorerName: "BscScan",
  rpcUrls: [
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc-rpc.publicnode.com",
    "https://56.rpc.thirdweb.com",
  ],
  isTestnet: false,
  usdcNote: "On BNB Chain, USDC is Binance-Peg (custodied by Binance, 18 decimals).",
};

const BASE_SEPOLIA_DEFAULT: ChainConfig = {
  chainId: 84532,
  name: "Base Sepolia",
  shortName: "Base Sepolia",
  sablierLockup: "0xa4777CA525d43a7aF55D45b11b430606d7416f8d",
  usdc: "0x54C0f145D70ca4792e695697B6498552F1EC0009",
  usdcDecimals: 6,
  treasury: ZERO_ADDRESS,
  explorerUrl: "https://sepolia.basescan.org",
  explorerName: "Base Sepolia BaseScan",
  rpcUrls: [
    "https://sepolia.base.org",
    "https://base-sepolia-rpc.publicnode.com",
  ],
  isTestnet: true,
};

export const DEFAULT_CHAIN_ID: number =
  process.env.NEXT_PUBLIC_CHAIN === "base-sepolia"
    ? BASE_SEPOLIA_DEFAULT.chainId
    : BASE_DEFAULT.chainId;

// Optional keyed RPC per chain (Alchemy, dRPC, …) with a referrer allowlist —
// the robust choice for production traffic. JSON object keyed by chainId:
//   NEXT_PUBLIC_RPC_URLS='{"8453":"https://base-mainnet.g.alchemy.com/v2/KEY"}'
// The override is prepended to the chain's public list, so the public
// endpoints stay as fallbacks. NEXT_PUBLIC_* bakes at build time — changing
// it on Vercel does nothing until a redeploy.
//
// Bad input degrades to the public defaults with a logged error rather than
// throwing: this runs in every browser session, and a config typo must not
// take the whole app down.
export function parseRpcOverrides(raw: string | undefined): Record<number, string> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[RipGuard] NEXT_PUBLIC_RPC_URLS is not valid JSON — using public RPCs");
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error("[RipGuard] NEXT_PUBLIC_RPC_URLS must be an object keyed by chainId — using public RPCs");
    return {};
  }
  const overrides: Record<number, string> = {};
  for (const [key, url] of Object.entries(parsed)) {
    const chainId = Number(key);
    if (!Number.isInteger(chainId) || typeof url !== "string" || !url.startsWith("https://")) {
      console.error(
        `[RipGuard] NEXT_PUBLIC_RPC_URLS entry "${key}" ignored — key must be a chainId, value an https URL`,
      );
      continue;
    }
    overrides[chainId] = url;
  }
  return overrides;
}

const RPC_OVERRIDES = parseRpcOverrides(process.env.NEXT_PUBLIC_RPC_URLS);

// RPC overrides apply to any chain. Address overrides only apply to the
// current deployment's default chain — kept for testnet staging flexibility;
// new chains should put addresses in code.
function withEnvOverrides(cfg: ChainConfig): ChainConfig {
  const rpcOverride = RPC_OVERRIDES[cfg.chainId];
  const withRpc: ChainConfig = rpcOverride
    ? { ...cfg, rpcUrls: [rpcOverride, ...cfg.rpcUrls] }
    : cfg;
  if (cfg.chainId !== DEFAULT_CHAIN_ID) return withRpc;
  return {
    ...withRpc,
    sablierLockup: (process.env.NEXT_PUBLIC_SABLIER_LOCKUP as Address) || cfg.sablierLockup,
    usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) || cfg.usdc,
    treasury: (process.env.NEXT_PUBLIC_TREASURY_ADDRESS as Address) || cfg.treasury,
  };
}

export const CHAINS: Record<number, ChainConfig> = {
  [ETHEREUM_DEFAULT.chainId]: withEnvOverrides(ETHEREUM_DEFAULT),
  [BASE_DEFAULT.chainId]: withEnvOverrides(BASE_DEFAULT),
  [ARBITRUM_DEFAULT.chainId]: withEnvOverrides(ARBITRUM_DEFAULT),
  [OPTIMISM_DEFAULT.chainId]: withEnvOverrides(OPTIMISM_DEFAULT),
  [POLYGON_DEFAULT.chainId]: withEnvOverrides(POLYGON_DEFAULT),
  [AVALANCHE_DEFAULT.chainId]: withEnvOverrides(AVALANCHE_DEFAULT),
  [BSC_DEFAULT.chainId]: withEnvOverrides(BSC_DEFAULT),
  [BASE_SEPOLIA_DEFAULT.chainId]: withEnvOverrides(BASE_SEPOLIA_DEFAULT),
};

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number);

// Chains this deployment can actually transact on: mainnets on ripguard.xyz,
// testnets on testnet.ripguard.xyz. The registry holds both, so anything
// user-facing (wallet picker, cross-chain lookups) should iterate this list,
// not CHAINS.
export const DEPLOYMENT_CHAINS: readonly ChainConfig[] = Object.values(CHAINS).filter(
  (c) => c.isTestnet === CHAINS[DEFAULT_CHAIN_ID].isTestnet,
);

export function getChainConfig(chainId: number): ChainConfig {
  const cfg = CHAINS[chainId];
  if (!cfg) {
    throw new Error(
      `Unsupported chainId: ${chainId}. Supported: ${SUPPORTED_CHAIN_IDS.join(", ")}`
    );
  }
  return cfg;
}

export function isSupportedChain(chainId: number | undefined): chainId is number {
  return chainId !== undefined && chainId in CHAINS;
}

// "Supported by THIS deployment" — registry membership AND testnet flag matches.
// Use this (not isSupportedChain) for any logic that gates on whether the
// current deployment can actually transact on a chain. The registry holds
// both mainnets and testnets; isSupportedChain returns true for any of them,
// which would let a mainnet wallet through the wrong-chain guard on the
// testnet deployment (and vice-versa).
export function isSupportedDeploymentChain(
  chainId: number | undefined,
  isTestnetDeployment: boolean,
): chainId is number {
  return (
    chainId !== undefined &&
    isSupportedChain(chainId) &&
    getChainConfig(chainId).isTestnet === isTestnetDeployment
  );
}
