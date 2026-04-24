import { type Address } from "viem";
import { DEFAULT_CHAIN_ID, ZERO_ADDRESS, getChainConfig } from "./chains";

// Default-chain view of the registry. These singleton exports are kept as a
// compatibility layer for the current single-chain call sites. The page
// refactor (RG-9430aa) will switch consumers to useChainId() + getChainConfig()
// and delete these, but landing the registry separately keeps production
// behavior identical while the refactor rolls out.
const defaultChain = getChainConfig(DEFAULT_CHAIN_ID);

export const SABLIER_LOCKUP: Address = defaultChain.sablierLockup;
export const USDC_ADDRESS: Address = defaultChain.usdc;
export const TREASURY: Address = defaultChain.treasury;
export const EXPLORER_URL: string = defaultChain.explorerUrl;
export const STREAM_START_BLOCK: bigint = defaultChain.streamStartBlock;
export const LOG_CHUNK_SIZE: bigint = defaultChain.logChunkSize;
export const IS_TESTNET: boolean = defaultChain.isTestnet;

// 0.5% broker fee in Sablier fixed-point (1e18 = 100%). Global — same fee on every chain.
// Disabled if treasury is zero address (Sablier reverts on zero-address broker with non-zero fee).
export const BROKER_FEE =
  TREASURY === ZERO_ADDRESS ? BigInt(0) : BigInt("5000000000000000"); // 5e15

// Human-readable fee percentage derived from BROKER_FEE (e.g. "0.5%")
export const BROKER_FEE_PCT =
  BROKER_FEE > BigInt(0)
    ? `${Number((BROKER_FEE * BigInt(10000)) / BigInt("1000000000000000000")) / 100}%`
    : "0%";

// Schedule presets — "build your own reloads". Global: schedules aren't chain-scoped.
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
