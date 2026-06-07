/**
 * Lifetime treasury earnings on Solana — paginates Helius's enhanced
 * transactions endpoint for the treasury wallet, then sums wSOL transfers
 * in/out. The TS-skim broker fee is just a wSOL transfer from the user
 * to the treasury, so summing inbound wSOL on the treasury captures
 * lifetime revenue.
 *
 *   pnpm earnings              → uses NEXT_PUBLIC_TREASURY_PUBKEY
 *   pnpm earnings <pubkey>     → any Solana wallet
 *
 * Why query the *owner* (not the wSOL ATA)?
 *   Helius's `/v0/addresses/{addr}/transactions` filters on top-level
 *   account participation. The owner is a top-level participant in every
 *   create/sweep tx; the ATA is a token account that may not be flagged
 *   as a "participant" by Helius's heuristic. Owner queries return more
 *   complete history, and we filter the wSOL transfers ourselves.
 *
 * Helius enhanced API requires an API key. We pull it out of the same
 * RPC URL the app uses (NEXT_PUBLIC_SOLANA_RPC). If you're running
 * against devnet, this script will report zero — Helius enhanced API
 * is mainnet-only.
 */
import { TREASURY_PUBKEY, RPC_URL, NETWORK, ZERO_PUBKEY, WSOL_MINT } from "../src/config/solsab";
import { PublicKey } from "@solana/web3.js";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  cyan: useColor ? "\x1b[36m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  green: useColor ? "\x1b[32m" : "",
  red: useColor ? "\x1b[31m" : "",
  bold: useColor ? "\x1b[1m" : "",
  dim: useColor ? "\x1b[2m" : "",
  reset: useColor ? "\x1b[0m" : "",
};

type TokenTransfer = {
  fromUserAccount?: string;
  toUserAccount?: string;
  mint?: string;
  // Helius normalizes amounts to the token's native unit (SOL, not lamports).
  tokenAmount: number;
};

type EnhancedTx = {
  signature: string;
  type: string;
  fee: number;
  timestamp: number;
  source?: string;
  description?: string;
  tokenTransfers?: TokenTransfer[];
};

function extractApiKey(rpcUrl: string): string | null {
  try {
    const url = new URL(rpcUrl);
    return url.searchParams.get("api-key");
  } catch {
    return null;
  }
}

async function fetchPage(treasury: PublicKey, apiKey: string, before?: string): Promise<EnhancedTx[]> {
  const u = new URL(`https://api.helius.xyz/v0/addresses/${treasury.toBase58()}/transactions`);
  u.searchParams.set("api-key", apiKey);
  u.searchParams.set("limit", "100");
  if (before) u.searchParams.set("before", before);
  const res = await fetch(u, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Helius HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error(`unexpected response shape: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json as EnhancedTx[];
}

async function main() {
  const argv = process.argv.slice(2);
  const target = argv[0] ? new PublicKey(argv[0]) : TREASURY_PUBKEY;

  if (target.equals(ZERO_PUBKEY)) {
    console.error(
      `\n${c.yellow}No treasury configured.${c.reset} Set NEXT_PUBLIC_TREASURY_PUBKEY in your env\nor pass an address as the first argument.\n`,
    );
    process.exit(1);
  }

  if (NETWORK !== "mainnet-beta") {
    console.error(
      `\n${c.yellow}NETWORK=${NETWORK}.${c.reset} Helius enhanced API is mainnet-only — switch NEXT_PUBLIC_SOLANA_NETWORK.\n`,
    );
    process.exit(1);
  }

  const apiKey = extractApiKey(RPC_URL);
  if (!apiKey) {
    console.error(
      `\n${c.red}Could not extract an api-key from NEXT_PUBLIC_SOLANA_RPC.${c.reset}\nThis script needs Helius's enhanced API; set a Helius RPC URL with ?api-key=... in your env.\n`,
    );
    process.exit(1);
  }

  console.log(`\n  ${c.bold}Address${c.reset}  ${target.toBase58()}`);
  console.log(`  ${c.dim}Network  ${NETWORK}${c.reset}\n`);

  // Paginate. Helius returns up to 100 per page, walks backward via `before`.
  let before: string | undefined;
  let totalTxs = 0;
  const all: EnhancedTx[] = [];
  // Hard cap so a runaway address can't drain the day's API quota.
  for (let page = 0; page < 50; page++) {
    const batch = await fetchPage(target, apiKey, before);
    if (batch.length === 0) break;
    all.push(...batch);
    totalTxs += batch.length;
    if (batch.length < 100) break;
    before = batch[batch.length - 1].signature;
  }

  console.log(`  ${c.dim}Scanned ${totalTxs} txs touching the treasury.${c.reset}`);

  const wsolMint = WSOL_MINT.toBase58();
  const treasuryStr = target.toBase58();

  let inboundLamports = 0n;
  let inboundCount = 0;
  let outboundLamports = 0n;
  let outboundCount = 0;
  const firstByDirection: { in?: number; out?: number } = {};

  // Helius hands us tokenAmount as a float in token units (SOL, not lamports).
  // Convert back to lamports for exact accumulation, then format on the way out.
  const toLamports = (amount: number): bigint => BigInt(Math.round(amount * 1_000_000_000));

  for (const tx of all) {
    for (const t of tx.tokenTransfers ?? []) {
      if (t.mint !== wsolMint) continue;
      if (t.toUserAccount === treasuryStr) {
        inboundLamports += toLamports(t.tokenAmount);
        inboundCount += 1;
        if (firstByDirection.in === undefined || tx.timestamp < firstByDirection.in) {
          firstByDirection.in = tx.timestamp;
        }
      }
      if (t.fromUserAccount === treasuryStr) {
        outboundLamports += toLamports(t.tokenAmount);
        outboundCount += 1;
        if (firstByDirection.out === undefined || tx.timestamp < firstByDirection.out) {
          firstByDirection.out = tx.timestamp;
        }
      }
    }
  }

  const fmt = (lamports: bigint): string => {
    const whole = lamports / 1_000_000_000n;
    const frac = (lamports % 1_000_000_000n).toString().padStart(9, "0").slice(0, 6);
    return `${whole}.${frac}`;
  };

  const inLine = inboundCount > 0 ? c.green + c.bold : c.dim;
  const outLine = outboundCount > 0 ? c.yellow : c.dim;

  console.log("");
  console.log(
    `  ${inLine}Broker fees in${c.reset}    ${fmt(inboundLamports).padStart(14)} SOL  ${c.dim}(${inboundCount} transfers)${c.reset}`,
  );
  console.log(
    `  ${outLine}Sweeps out${c.reset}        ${fmt(outboundLamports).padStart(14)} SOL  ${c.dim}(${outboundCount} transfers)${c.reset}`,
  );
  console.log(`  ${c.dim}──────────────────────────────────────────${c.reset}`);
  const net = inboundLamports - outboundLamports;
  console.log(
    `  ${c.bold}Net wSOL${c.reset}          ${fmt(net).padStart(14)} SOL  ${c.dim}(should ≈ current balance)${c.reset}`,
  );

  if (firstByDirection.in !== undefined) {
    const d = new Date(firstByDirection.in * 1000).toISOString().slice(0, 10);
    console.log(`\n  ${c.dim}First broker fee: ${d}${c.reset}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
