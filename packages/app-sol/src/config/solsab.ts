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
// Address Lookup Table (create/lock tx → v0)
// ----------------------------------------------------------------------------
//
// The create/lock tx is account-heavy (Sablier + Metaplex). To leave room for
// Blowfish/Lighthouse guard injection we compress the fixed, non-program
// accounts (collection PDAs, wSOL mint, treasury + its ATA, rent sysvar) into
// an on-chain ALT and send the lock as a v0 transaction. Create the table once
// with `scripts/create-lookup-table.ts`, then set NEXT_PUBLIC_LOOKUP_TABLE.
//
// Null when unset → the lock flow falls back to the legacy (Helius-broadcast)
// path, so an unconfigured or unreachable table never breaks lock creation.
const lookupTableEnv = process.env.NEXT_PUBLIC_LOOKUP_TABLE;
export const LOOKUP_TABLE_ADDRESS: PublicKey | null = lookupTableEnv
  ? new PublicKey(lookupTableEnv)
  : null;

// ----------------------------------------------------------------------------
// Deposit token (Wrapped SOL)
// ----------------------------------------------------------------------------
//
// RipGuard on Solana locks SOL — the native asset. Sablier streams SPL
// tokens, not native SOL, so we wrap into wSOL transparently before the
// lock. The wSOL mint is the same on every Solana cluster.
//
// Why SOL and not USDC: degens on Solana hold SOL. Locking USDC means
// giving up the SOL exposure they came for. The "save me from myself"
// thesis is about preventing panic-sells and chase-pumps, both of which
// SOL-locking enforces while still preserving upside.

export const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);

// SOL has 9 decimals on chain (1 SOL = 1_000_000_000 lamports). All amount
// math in this app uses base units (lamports) as bigint.
export const SOL_DECIMALS = 9;

// Display label — keeps copy in one place if we ever support other tokens.
export const DEPOSIT_TOKEN_LABEL = "SOL";

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
// Priority fee
// ----------------------------------------------------------------------------
//
// Mainnet leaders deprioritize txs with no compute-unit price during any
// contention — our 600k-CU txs would routinely miss the ~60s blockhash
// validity window, surfacing as "Signature has expired: block height
// exceeded." Setting a small price per CU is the standard fix.
//
// 500k microLamports/CU × 600k CU = 300k lamports (~$0.07 at $230 SOL).
// Mainnet medians during contention are 100k–1M µLamports/CU; sized to
// land in the next block even on busy days. Tune via env for spikes.

const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 500_000;

export const PRIORITY_FEE_MICRO_LAMPORTS: number = (() => {
  const raw = process.env.NEXT_PUBLIC_PRIORITY_FEE_MICRO_LAMPORTS;
  if (!raw) return DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS;
})();

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
