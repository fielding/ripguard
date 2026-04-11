import { type Address } from "viem";

// Chain-aware addresses — set via env vars for testnet deployments
export const SABLIER_LOCKUP: Address =
  (process.env.NEXT_PUBLIC_SABLIER_LOCKUP as Address) ||
  "0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B"; // Base mainnet default

export const USDC_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_USDC_ADDRESS as Address) ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet default

// RipGuard Audit Fund treasury
export const TREASURY: Address =
  (process.env.NEXT_PUBLIC_TREASURY_ADDRESS as Address) ||
  "0x847F640bE052b0700C31F72Dce622F4C6286934E"; // Base mainnet default

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// 0.5% broker fee in Sablier fixed-point (1e18 = 100%)
// Disabled if treasury is zero address (Sablier reverts on zero-address broker with non-zero fee)
export const BROKER_FEE =
  TREASURY === ZERO_ADDRESS ? BigInt(0) : BigInt("5000000000000000"); // 5e15

// Human-readable fee percentage derived from BROKER_FEE (e.g. "0.5%")
export const BROKER_FEE_PCT =
  BROKER_FEE > BigInt(0)
    ? `${Number((BROKER_FEE * BigInt(10000)) / BigInt("1000000000000000000")) / 100}%`
    : "0%";

// Whether we're running on a testnet
export const IS_TESTNET = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia";

// Block explorer base URL
export const EXPLORER_URL = IS_TESTNET
  ? "https://sepolia.basescan.org"
  : "https://basescan.org";

// Safe starting block for event queries
// Testnet: TestUSDC (0x54C0f145D70ca4792e695697B6498552F1EC0009) deployed between blocks 38,540,000–38,550,000
// Mainnet: safe baseline before RipGuard launch
export const STREAM_START_BLOCK = IS_TESTNET
  ? BigInt(38_540_000) // Just before TestUSDC deployment on Base Sepolia
  : BigInt(22_000_000); // Base mainnet

// Max block range per getLogs call.
// Public Base Sepolia RPCs allow up to 10k blocks per call.
// Mainnet paid RPCs (Alchemy etc.) support up to 50k.
export const LOG_CHUNK_SIZE = IS_TESTNET ? BigInt(10_000) : BigInt(50_000);

// Schedule presets — "build your own reloads"
export const PRESETS = {
  hourly1d: {
    label: "Hourly Payouts (24h)",
    description: "Reload every hour for 24 hours",
    cliffSeconds: 0,
    totalSeconds: 24 * 60 * 60,
    isLumpSum: false,
  },
  hourly3d: {
    label: "Hourly Payouts (3d)",
    description: "Reload every hour for 3 days",
    cliffSeconds: 0,
    totalSeconds: 3 * 24 * 60 * 60,
    isLumpSum: false,
  },
  hourly1w: {
    label: "Hourly Payouts (1w)",
    description: "Reload every hour for 7 days",
    cliffSeconds: 0,
    totalSeconds: 7 * 24 * 60 * 60,
    isLumpSum: false,
  },
  daily1w: {
    label: "Daily Payouts (1w)",
    description: "Reload once a day for 7 days",
    cliffSeconds: 0,
    totalSeconds: 7 * 24 * 60 * 60,
    isLumpSum: false,
  },
  panicLock1d: {
    label: "Panic Lock (24h)",
    description: "Lock everything for 24 hours",
    cliffSeconds: 24 * 60 * 60,
    totalSeconds: 24 * 60 * 60 + 1, // cliff < total required by Sablier
    isLumpSum: false,
  },
  panicThenDaily: {
    label: "Panic Lock + Daily Payouts",
    description: "1 day lock, then daily reloads for 7 days",
    cliffSeconds: 24 * 60 * 60,
    totalSeconds: 8 * 24 * 60 * 60, // 1d cliff + 7d vest
    isLumpSum: false,
  },
} as const;
