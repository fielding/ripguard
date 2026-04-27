/**
 * Solana / SolSab config.
 *
 * Single source of truth for chain selection (devnet vs mainnet-beta),
 * RPC endpoint, program IDs, USDC mint, treasury, and the broker-fee math
 * we apply client-side (no native broker fee on Solana — see
 * memory/project_solana_phase0.md for context).
 *
 * Drives env-based switching the same way the EVM app's chains.ts /
 * contracts.ts does.
 */
import { PublicKey } from "@solana/web3.js";

// ----------------------------------------------------------------------------
// Network
// ----------------------------------------------------------------------------

export type SolanaCluster = "mainnet-beta" | "devnet";

const RAW_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet").toLowerCase();
export const NETWORK: SolanaCluster =
  RAW_NETWORK === "mainnet-beta" || RAW_NETWORK === "mainnet"
    ? "mainnet-beta"
    : "devnet";

export const IS_DEVNET = NETWORK === "devnet";
export const IS_MAINNET = NETWORK === "mainnet-beta";

// EVM app calls this IS_TESTNET — keep the name so layout/manifest/SEO
// plumbing doesn't have to fork. On Solana, "testnet" semantically means
// devnet (the validator-rotation `testnet` cluster isn't useful for apps).
export const IS_TESTNET = IS_DEVNET;

// Public RPC defaults. Public mainnet-beta is heavily rate-limited — set
// NEXT_PUBLIC_SOLANA_RPC to a Helius / Triton / Quicknode URL for prod.
const PUBLIC_RPCS: Record<SolanaCluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC ?? PUBLIC_RPCS[NETWORK];

// ----------------------------------------------------------------------------
// Programs (SolSab v0.1 — same address on both clusters)
// ----------------------------------------------------------------------------

// Sablier Lockup program. Source: sablier-labs/solsab README.
export const SABLIER_LOCKUP_PROGRAM_ID = new PublicKey(
  "4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC",
);

// Sablier Merkle Instant (airdrop campaigns) — not used by RipGuard,
// kept here for completeness / future feature flagging.
export const MERKLE_INSTANT_PROGRAM_ID = new PublicKey(
  "7XrxoQejBoGouW4V3aozTSwub7xSDjYqB4Go7YLjF9rV",
);

// ----------------------------------------------------------------------------
// USDC
// ----------------------------------------------------------------------------

const USDC_MINTS: Record<SolanaCluster, string> = {
  // Circle's official USDC mint on Solana mainnet (6 decimals).
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  // Devnet placeholder — Circle's devnet USDC mint. Override via env if a
  // different mintable test token is preferred.
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ?? USDC_MINTS[NETWORK],
);

export const USDC_DECIMALS = 6;

// ----------------------------------------------------------------------------
// Treasury (broker fee recipient)
// ----------------------------------------------------------------------------

// All-zeros pubkey — used as a sentinel meaning "no treasury, fee disabled."
// Devnet defaults to this so we don't accidentally take a fee in dev.
export const ZERO_PUBKEY = new PublicKey(new Uint8Array(32));

const treasuryEnv = process.env.NEXT_PUBLIC_TREASURY_PUBKEY;
export const TREASURY_PUBKEY = treasuryEnv
  ? new PublicKey(treasuryEnv)
  : ZERO_PUBKEY;

// ----------------------------------------------------------------------------
// Broker fee (TS-skim — there is no native broker arg on Solana)
// ----------------------------------------------------------------------------

// 0.5% expressed in basis points (50 bps). Pin parity with EVM's
// BROKER_FEE_RATE (5e15 / 1e18 = 0.005). Kept as bigint so amount math stays
// in bigint end-to-end and we never accidentally drop precision.
export const BROKER_FEE_BPS = BigInt(50);
const BPS_DENOMINATOR = BigInt(10_000);

/**
 * Absolute broker fee amount, in token base units (USDC = 6 decimals).
 *
 * On Solana we do this skim ourselves, as a separate SPL transfer, prior
 * to calling Sablier's `create_with_durations_ll`. Mirrors the EVM app's
 * `computeBrokerFee` from packages/app — same rate, same floor rounding.
 *
 * Caller's responsibility: handle the rounds-to-zero case (any deposit
 * smaller than 200 base units = 0.0002 USDC produces a 0 fee, which we
 * either skip or block at the form level).
 */
export function computeBrokerFee(amount: bigint, bps: bigint = BROKER_FEE_BPS): bigint {
  if (TREASURY_PUBKEY.equals(ZERO_PUBKEY)) return BigInt(0);
  return (amount * bps) / BPS_DENOMINATOR;
}

// ----------------------------------------------------------------------------
// Explorer
// ----------------------------------------------------------------------------

export const EXPLORER_URL =
  NETWORK === "mainnet-beta"
    ? "https://solscan.io"
    : "https://solscan.io"; // append `?cluster=devnet` per route

export function explorerTx(signature: string): string {
  return NETWORK === "mainnet-beta"
    ? `${EXPLORER_URL}/tx/${signature}`
    : `${EXPLORER_URL}/tx/${signature}?cluster=devnet`;
}

export function explorerAccount(pubkey: string | PublicKey): string {
  const key = typeof pubkey === "string" ? pubkey : pubkey.toBase58();
  return NETWORK === "mainnet-beta"
    ? `${EXPLORER_URL}/account/${key}`
    : `${EXPLORER_URL}/account/${key}?cluster=devnet`;
}

// ----------------------------------------------------------------------------
// Schedule presets (chain-agnostic — same shape as EVM)
// ----------------------------------------------------------------------------

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
    totalSeconds: 24 * 60 * 60 + 1,
    isLumpSum: false,
  },
  panicThenDaily: {
    label: "Panic Lock + Daily Payouts",
    description: "1 day lock, then daily reloads for 7 days",
    cliffSeconds: 24 * 60 * 60,
    totalSeconds: 8 * 24 * 60 * 60,
    isLumpSum: false,
  },
} as const;

export type PresetKey = keyof typeof PRESETS;
