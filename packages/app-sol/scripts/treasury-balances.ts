/**
 * Treasury balance check for the Solana surface — read-only.
 *
 *   pnpm balances              → checks NEXT_PUBLIC_TREASURY_PUBKEY (or
 *                                 falls back to the ZERO_PUBKEY sentinel)
 *   pnpm balances <pubkey>     → checks any Solana wallet
 *
 * Reports two numbers:
 *
 *   - Native SOL balance of the wallet itself (lamports → SOL). This is
 *     mostly tx-fee runway; broker fees don't accumulate here.
 *   - wSOL balance of the wallet's wSOL ATA. This is where 0.5% TS-skim
 *     broker fees actually land. Sablier on Solana streams SPL tokens
 *     and our pre-transfer is denominated in wSOL.
 *
 * Closing the wSOL ATA (e.g., via Phantom's "Burn / Close Account") is
 * the standard way to convert accumulated wSOL back to native SOL when
 * sweeping treasury revenue.
 */
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";

import {
  TREASURY_PUBKEY,
  WSOL_MINT,
  ZERO_PUBKEY,
  RPC_URL,
  NETWORK,
} from "../src/config/solsab";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  cyan: useColor ? "\x1b[36m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  bold: useColor ? "\x1b[1m" : "",
  dim: useColor ? "\x1b[2m" : "",
  reset: useColor ? "\x1b[0m" : "",
};

function fmt(amount: bigint, decimals: number): string {
  if (amount === 0n) return `0.${"0".repeat(Math.min(decimals, 6))}`;
  const whole = amount / BigInt(10) ** BigInt(decimals);
  const frac = amount % BigInt(10) ** BigInt(decimals);
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6);
  return `${whole.toString()}.${fracStr}`;
}

function colorIfNonZero(amount: bigint, label: string): string {
  return amount > 0n ? `${c.cyan}${label}${c.reset}` : `${c.dim}${label}${c.reset}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const target = argv[0]
    ? new PublicKey(argv[0])
    : TREASURY_PUBKEY;

  if (target.equals(ZERO_PUBKEY)) {
    console.error(
      `\n${c.yellow}No treasury configured.${c.reset} Set NEXT_PUBLIC_TREASURY_PUBKEY in your env\nor pass an address as the first argument:\n\n  pnpm --filter app-sol balances <pubkey>\n`,
    );
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");

  console.log("");
  console.log(`  ${c.bold}Address${c.reset}  ${target.toBase58()}`);
  console.log(`  ${c.dim}Network  ${NETWORK} (${RPC_URL.replace(/api-key=[^&]+/, "api-key=…")})${c.reset}`);
  console.log("");

  // Native SOL balance of the wallet account itself.
  const lamports = await connection.getBalance(target, "confirmed");
  const solAmount = BigInt(lamports);
  const solLine = colorIfNonZero(solAmount, "Native SOL");
  console.log(
    `  ${solLine.padEnd(useColor ? 32 : 20)} ${fmt(solAmount, 9).padStart(14)} SOL`,
  );

  // wSOL balance held in the treasury's wSOL ATA — where broker fees go.
  const wsolAta = getAssociatedTokenAddressSync(WSOL_MINT, target, true);
  let wsolAmount = 0n;
  let wsolNote = "";
  try {
    const acc = await getAccount(connection, wsolAta, "confirmed");
    wsolAmount = acc.amount;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("could not find account") || msg.includes("Account does not exist")) {
      wsolNote = `${c.dim}(no wSOL ATA yet — first lock will create it)${c.reset}`;
    } else {
      wsolNote = `${c.yellow}(error: ${msg})${c.reset}`;
    }
  }
  const wsolLine = colorIfNonZero(wsolAmount, "Wrapped SOL");
  console.log(
    `  ${wsolLine.padEnd(useColor ? 32 : 20)} ${fmt(wsolAmount, 9).padStart(14)} SOL ${wsolNote}`,
  );

  console.log(`  ${c.dim}──────────────────────────────────────${c.reset}`);
  const totalSol = solAmount + wsolAmount;
  console.log(
    `  ${c.bold}Total${c.reset.padEnd(useColor ? 24 : 16)} ${fmt(totalSol, 9).padStart(14)} SOL`,
  );
  console.log("");
  console.log(
    `  ${c.dim}wSOL ATA: ${wsolAta.toBase58()}${c.reset}`,
  );
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
