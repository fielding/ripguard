import { type Address } from "viem";
import { DEFAULT_CHAIN_ID, ZERO_ADDRESS, getChainConfig } from "./chains";

// Site-level testnet flag — driven by the deployment, not per-chain.
// Used by metadata, robots, sitemap, manifest, OG image, and the testnet banner.
export const IS_TESTNET: boolean = getChainConfig(DEFAULT_CHAIN_ID).isTestnet;

// 0.5% broker fee rate in Sablier fixed-point (1e18 = 100%). Same rate on every chain.
export const BROKER_FEE_RATE = BigInt("5000000000000000"); // 5e15

// Broker fee for a chain's treasury. Returns 0 when treasury is the zero
// address — Sablier reverts on a zero-address broker with a non-zero fee,
// so this is the canonical "fee disabled" signal (used on testnets).
export function brokerFeeForTreasury(treasury: Address): bigint {
  return treasury === ZERO_ADDRESS ? BigInt(0) : BROKER_FEE_RATE;
}

// Human-readable percentage for a broker fee value (e.g. "0.5%").
export function brokerFeePctString(fee: bigint): string {
  return fee > BigInt(0)
    ? `${Number((fee * BigInt(10000)) / BigInt("1000000000000000000")) / 100}%`
    : "0%";
}

// Absolute broker fee amount, in the deposit token's decimals.
// Mirrors Sablier's UD60x18 math: amount * rate / 1e18, floor.
//
// On EVM the protocol does this for us. We expose the helper here so the
// Solana app can TS-skim the same amount client-side and pin parity in tests.
export function computeBrokerFee(amount: bigint, rate: bigint): bigint {
  return (amount * rate) / BigInt("1000000000000000000");
}

// Schedule presets — "build your own reloads". Global: schedules aren't chain-scoped.
export const PRESETS = {
  hourly1d: {
    label: "Hourly Payouts (24h)",
    description: "Reload every hour for 24 hours",
    cliffSeconds: 0,
    intervalSeconds: 60 * 60,
    totalSeconds: 24 * 60 * 60,
    isLumpSum: false,
  },
  hourly3d: {
    label: "Hourly Payouts (3d)",
    description: "Reload every hour for 3 days",
    cliffSeconds: 0,
    intervalSeconds: 60 * 60,
    totalSeconds: 3 * 24 * 60 * 60,
    isLumpSum: false,
  },
  hourly1w: {
    label: "Hourly Payouts (1w)",
    description: "Reload every hour for 7 days",
    cliffSeconds: 0,
    intervalSeconds: 60 * 60,
    totalSeconds: 7 * 24 * 60 * 60,
    isLumpSum: false,
  },
  daily1w: {
    label: "Daily Payouts (1w)",
    description: "Reload once a day for 7 days",
    cliffSeconds: 0,
    intervalSeconds: 24 * 60 * 60,
    totalSeconds: 7 * 24 * 60 * 60,
    isLumpSum: false,
  },
  panicLock1d: {
    label: "Panic Lock (24h)",
    description: "Lock everything for 24 hours",
    cliffSeconds: 24 * 60 * 60,
    intervalSeconds: 60 * 60,
    totalSeconds: 24 * 60 * 60 + 1, // cliff < total required by Sablier
    isLumpSum: false,
  },
  panicThenDaily: {
    label: "Panic Lock + Daily Payouts",
    description: "1 day lock, then daily reloads for 7 days",
    cliffSeconds: 24 * 60 * 60,
    intervalSeconds: 24 * 60 * 60,
    totalSeconds: 8 * 24 * 60 * 60, // 1d cliff + 7d vest
    isLumpSum: false,
  },
} as const;
