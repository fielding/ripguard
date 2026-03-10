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
    ? `${Number((BROKER_FEE * BigInt(10000)) / BigInt("10000000000000000")) / 100}%`
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
// Public Base Sepolia RPCs (RainbowKit defaults) reject ranges > ~2k blocks.
// Mainnet paid RPCs (Alchemy etc.) support up to 50k.
export const LOG_CHUNK_SIZE = IS_TESTNET ? BigInt(2_000) : BigInt(50_000);

// Schedule presets
export const PRESETS = {
  panicLock7d: {
    label: "Panic Lock 7D",
    description: "Lock everything for 7 days",
    cliffSeconds: 7 * 24 * 60 * 60,
    totalSeconds: 7 * 24 * 60 * 60,
    isLumpSum: true,
  },
  lock30d: {
    label: "Lock 30D",
    description: "Linear vest over 30 days",
    cliffSeconds: 0,
    totalSeconds: 30 * 24 * 60 * 60,
    isLumpSum: false,
  },
  cliff7dVest90d: {
    label: "Cliff 7D + Vest 90D",
    description: "7-day cliff, then linear vest over 90 days",
    cliffSeconds: 7 * 24 * 60 * 60,
    totalSeconds: 97 * 24 * 60 * 60, // 7d cliff + 90d vest
    isLumpSum: false,
  },
} as const;
