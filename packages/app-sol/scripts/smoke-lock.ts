/**
 * Smoke-test the lock-creation flow against devnet without sending a real
 * transaction. Validates that the IDL casing, PDA derivations, instruction
 * discriminator, and account list are all correct.
 *
 *   pnpm --filter app-sol smoke:lock
 *   KEYPAIR=~/.config/solana/id.json pnpm --filter app-sol smoke:lock
 *   USDC_MINT=AnyDevnetMint... AMOUNT_USDC=10 pnpm --filter app-sol smoke:lock
 *
 * What it does:
 *   1. Loads (or generates) a Solana keypair.
 *   2. Builds a lock tx with fixed-but-real arguments via buildLockTx.
 *   3. Calls connection.simulateTransaction.
 *   4. Prints the simulation result — Anchor errors, missing accounts,
 *      unexpected program logs, etc.
 *
 * Why simulate instead of submit: the failure modes we care about (broken
 * IDL/PDA wiring, wrong discriminator, missing accounts) all surface during
 * simulation. Insufficient-fund errors are the *expected* outcome when we
 * use an unfunded keypair — that's actually a positive signal because it
 * means everything before that check passed.
 */

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { buildLockTx } from "../src/sol/lock";
import { randomSalt } from "../src/sol/pdas";
import { presetToSolanaArgs } from "../src/sol/preset";

const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";
const KEYPAIR_PATH = process.env.KEYPAIR ?? join(homedir(), ".config/solana/id.json");
const AMOUNT_USDC = process.env.AMOUNT_USDC ?? "1";

async function loadKeypair(): Promise<Keypair> {
  try {
    const raw = await readFile(KEYPAIR_PATH, "utf8");
    const bytes = Uint8Array.from(JSON.parse(raw) as number[]);
    const kp = Keypair.fromSecretKey(bytes);
    console.log(`Loaded keypair from ${KEYPAIR_PATH}`);
    console.log(`  pubkey: ${kp.publicKey.toBase58()}`);
    return kp;
  } catch {
    const kp = Keypair.generate();
    console.log(`No keypair at ${KEYPAIR_PATH} — generated an ephemeral one`);
    console.log(`  pubkey: ${kp.publicKey.toBase58()}`);
    return kp;
  }
}

function dollarsToBaseUnits(amount: string): bigint {
  const [whole = "0", frac = ""] = amount.split(".");
  const padded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * BigInt(1_000_000) + BigInt(padded || "0");
}

// Stub Anchor wallet used purely for instruction-builder typing.
// simulateTransaction doesn't require a signature, so signTransaction is
// never called here. Cast to anchor.Wallet to bypass the generic
// signTransaction<T extends Transaction | VersionedTransaction> shape.
function makeStubWallet(payer: Keypair): anchor.Wallet {
  return {
    publicKey: payer.publicKey,
    payer,
    signTransaction: async () => {
      throw new Error("smoke-lock: signTransaction should not be called");
    },
    signAllTransactions: async () => {
      throw new Error("smoke-lock: signAllTransactions should not be called");
    },
  } as unknown as anchor.Wallet;
}

async function main() {
  console.log(`RPC: ${RPC}`);
  const connection = new Connection(RPC, "confirmed");
  const keypair = await loadKeypair();
  const provider = new anchor.AnchorProvider(connection, makeStubWallet(keypair), {
    commitment: "confirmed",
  });

  let balance = await connection.getBalance(keypair.publicKey);
  console.log(`  SOL balance: ${(balance / 1e9).toFixed(4)} SOL`);

  // Devnet airdrop just enough to materialize the fee-payer account.
  // simulateTransaction surfaces "AccountNotFound" when the fee payer has
  // never been touched, which masks downstream Anchor errors.
  let airdropOk = balance >= 1_000_000;
  if (!airdropOk && RPC.includes("devnet")) {
    console.log(`  airdropping 0.05 SOL on devnet…`);
    try {
      const sig = await connection.requestAirdrop(keypair.publicKey, 50_000_000);
      await connection.confirmTransaction(sig, "confirmed");
      balance = await connection.getBalance(keypair.publicKey);
      console.log(`  SOL balance after airdrop: ${(balance / 1e9).toFixed(4)} SOL`);
      airdropOk = true;
    } catch (err) {
      console.log(
        `  airdrop failed (devnet faucet rate-limited): ${(err as Error).message}`,
      );
      console.log(
        `  proceeding anyway — simulation may surface AccountNotFound`,
      );
    }
  }

  const depositAmount = dollarsToBaseUnits(AMOUNT_USDC);
  const presetArgs = presetToSolanaArgs("hourly1d");
  const salt = randomSalt();
  const usdcMint = process.env.USDC_MINT
    ? new PublicKey(process.env.USDC_MINT)
    : undefined;

  console.log(`\nBuilding lock tx:`);
  console.log(`  preset: hourly1d`);
  console.log(`  amount: ${AMOUNT_USDC} USDC (${depositAmount} base units)`);
  console.log(`  cliff/total seconds: ${presetArgs.cliffSeconds} / ${presetArgs.totalSeconds}`);
  console.log(`  salt: ${salt}`);

  const { instructions, pdas, feeAmount, netDepositAmount, feeActive } =
    await buildLockTx({
      provider,
      signer: keypair.publicKey,
      recipient: keypair.publicKey,
      depositAmount,
      cliffSeconds: presetArgs.cliffSeconds,
      totalSeconds: presetArgs.totalSeconds,
      salt,
      depositTokenMint: usdcMint,
    });

  console.log(`\nDerived PDAs:`);
  console.log(`  stream NFT mint:        ${pdas.streamNftMint.toBase58()}`);
  console.log(`  stream data:            ${pdas.streamData.toBase58()}`);
  console.log(`  stream data ATA:        ${pdas.streamDataAta.toBase58()}`);
  console.log(`  creator ATA:            ${pdas.creatorAta.toBase58()}`);
  console.log(`  recipient stream NFT:   ${pdas.recipientStreamNftAta.toBase58()}`);
  console.log(`  nft collection mint:    ${pdas.nftCollectionMint.toBase58()}`);

  console.log(`\nInstructions in tx: ${instructions.length}`);
  console.log(`  fee active: ${feeActive}`);
  console.log(`  fee amount: ${feeAmount} base units`);
  console.log(`  net deposit: ${netDepositAmount} base units`);

  const tx = new Transaction();
  for (const ix of instructions) tx.add(ix);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = keypair.publicKey;

  console.log(`\nSimulating against ${RPC}…\n`);
  const sim = await connection.simulateTransaction(tx, [keypair], false);

  if (sim.value.err) {
    console.log(`Simulation reported an error:`);
    console.log(JSON.stringify(sim.value.err, null, 2));
  } else {
    console.log(`Simulation succeeded.`);
  }

  if (sim.value.logs) {
    console.log(`\n--- program logs ---`);
    for (const line of sim.value.logs) console.log(line);
  }

  if (sim.value.err) {
    // Distinguish "expected failure" (no funds, missing ATA token balance)
    // from "wiring is broken" (Anchor program error, missing account, etc.)
    //
    // The strong-success pattern: the SolSab Lockup program runs, dispatches
    // through its NFT/metadata/collection CPIs, and only fails when it tries
    // to SPL-transfer USDC from the creator's empty ATA. We check for that
    // exact shape — Token program failing with 0x1 (insufficient funds)
    // inside the SolSab program's invoke chain.
    const logs = sim.value.logs ?? [];
    const reachedSolsab = logs.some((l) =>
      l.includes("4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC"),
    );
    const tokenInsufficient =
      logs.some((l) => l.includes("Error: insufficient funds")) &&
      logs.some((l) =>
        l.includes("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed: custom program error: 0x1"),
      );
    const programDispatched = logs.some((l) =>
      l.includes("Program log: IX: Create Metadata Accounts"),
    );

    if (reachedSolsab && tokenInsufficient && programDispatched) {
      console.log(
        `\n✓ STRONG SUCCESS SIGNAL`,
      );
      console.log(
        `  The SolSab Lockup program dispatched, ran all NFT / metadata / master`,
      );
      console.log(
        `  edition / collection CPIs, and only failed at the final SPL transfer`,
      );
      console.log(
        `  because the creator ATA has 0 USDC. With real USDC, this tx lands.`,
      );
      console.log(`  Wiring validated.`);
    } else {
      const errStr = JSON.stringify(sim.value.err);
      const otherExpected =
        errStr.includes("InsufficientFunds") ||
        errStr.includes("AccountNotFound");
      const errStrLower = errStr.toLowerCase();
      const isAccountNotFound = errStrLower.includes("accountnotfound");

      if (isAccountNotFound && !airdropOk) {
        console.log(
          `\nFee-payer account doesn't exist on chain and the devnet airdrop`,
        );
        console.log(
          `was rate-limited. This is NOT a wiring issue — retry in a few minutes,`,
        );
        console.log(
          `or pass KEYPAIR=/path/to/funded.json to use a wallet that already has SOL.`,
        );
      } else if (otherExpected) {
        console.log(
          `\nThe failure looks like an expected funding issue, but the program`,
        );
        console.log(
          `didn't reach the deep CPIs. Probably worth a closer look at logs above.`,
        );
      } else {
        console.log(
          `\nThis looks like a real wiring problem worth investigating.`,
        );
        process.exitCode = 1;
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
