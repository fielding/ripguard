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
  streamStartBlock: bigint;
  logChunkSize: bigint;
  isTestnet: boolean;
};

export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

const BASE_DEFAULT: ChainConfig = {
  chainId: 8453,
  name: "Base",
  shortName: "Base",
  sablierLockup: "0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  usdcDecimals: 6,
  treasury: "0x847F640bE052b0700C31F72Dce622F4C6286934E",
  explorerUrl: "https://basescan.org",
  streamStartBlock: BigInt(22_000_000),
  logChunkSize: BigInt(50_000),
  isTestnet: false,
};

const BASE_SEPOLIA_DEFAULT: ChainConfig = {
  chainId: 84532,
  name: "Base Sepolia",
  shortName: "Base Sepolia",
  sablierLockup: "0xa4777ca525d43a7af55d45b11b430606d7416f8d",
  usdc: "0x54C0f145D70ca4792e695697B6498552F1EC0009",
  usdcDecimals: 6,
  treasury: ZERO_ADDRESS,
  explorerUrl: "https://sepolia.basescan.org",
  streamStartBlock: BigInt(38_540_000),
  logChunkSize: BigInt(10_000),
  isTestnet: true,
};

export const DEFAULT_CHAIN_ID: number =
  process.env.NEXT_PUBLIC_CHAIN === "base-sepolia"
    ? BASE_SEPOLIA_DEFAULT.chainId
    : BASE_DEFAULT.chainId;

// Env overrides only apply to the current deployment's default chain.
// Kept for testnet staging flexibility; new chains should put addresses in code.
function withEnvOverrides(cfg: ChainConfig): ChainConfig {
  if (cfg.chainId !== DEFAULT_CHAIN_ID) return cfg;
  return {
    ...cfg,
    sablierLockup: (process.env.NEXT_PUBLIC_SABLIER_LOCKUP as Address) || cfg.sablierLockup,
    usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) || cfg.usdc,
    treasury: (process.env.NEXT_PUBLIC_TREASURY_ADDRESS as Address) || cfg.treasury,
  };
}

export const CHAINS: Record<number, ChainConfig> = {
  [BASE_DEFAULT.chainId]: withEnvOverrides(BASE_DEFAULT),
  [BASE_SEPOLIA_DEFAULT.chainId]: withEnvOverrides(BASE_SEPOLIA_DEFAULT),
};

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number);

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
