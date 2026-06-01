/**
 * One-time: create the Address Lookup Table (ALT) that lets the create/lock
 * tx ship as a v0 transaction with room for Blowfish/Lighthouse guards.
 *
 *   KEYPAIR=~/.config/solana/id.json \
 *   SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=… \
 *   pnpm --filter app-sol exec tsx scripts/create-lookup-table.ts
 *
 * What it does:
 *   1. Loads your keypair (the table's payer + authority).
 *   2. Derives the 8 FIXED, non-program accounts every lock touches.
 *   3. Creates the ALT and extends it with those 8 accounts.
 *   4. Prints the ALT address → set it as NEXT_PUBLIC_LOOKUP_TABLE.
 *
 * Only NON-PROGRAM, NON-SIGNER accounts go in the table: Solana forbids
 * sourcing an instruction's program id from a lookup table, and the fee payer
 * must stay static. Program ids and per-stream/per-user accounts are excluded
 * on purpose — see the plan / config/solsab.ts.
 *
 * Run against the SAME cluster the app uses. The table is usable ~1 slot after
 * the extend confirms; we wait for that before printing success.
 */

import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  SABLIER_LOCKUP_PROGRAM_ID,
  WSOL_MINT,
  TREASURY_PUBKEY,
  ZERO_PUBKEY,
} from "../src/config/solsab";
import { RENT_SYSVAR_ID } from "../src/sol/programs";
import {
  deriveNftCollectionData,
  deriveNftCollectionMint,
  deriveMetadata,
  deriveMasterEdition,
} from "../src/sol/pdas";

const RPC =
  process.env.SOLANA_RPC ??
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  "https://api.mainnet-beta.solana.com";
const KEYPAIR_PATH =
  process.env.KEYPAIR ?? join(homedir(), ".config/solana/id.json");

async function loadKeypair(): Promise<Keypair> {
  const raw = await readFile(KEYPAIR_PATH, "utf8");
  const bytes = Uint8Array.from(JSON.parse(raw) as number[]);
  const kp = Keypair.fromSecretKey(bytes);
  console.log(`Loaded keypair from ${KEYPAIR_PATH}`);
  console.log(`  pubkey: ${kp.publicKey.toBase58()}`);
  return kp;
}

/** The 8 fixed, non-program accounts that go in the ALT. */
function lookupAccounts(): { label: string; address: PublicKey }[] {
  if (TREASURY_PUBKEY.equals(ZERO_PUBKEY)) {
    throw new Error(
      "TREASURY_PUBKEY is the zero sentinel (fee disabled). Set " +
        "NEXT_PUBLIC_TREASURY_PUBKEY before building the mainnet ALT.",
    );
  }

  const [nftCollectionData] = deriveNftCollectionData();
  const [nftCollectionMint] = deriveNftCollectionMint();
  const [nftCollectionMetadata] = deriveMetadata(nftCollectionMint);
  const [nftCollectionMasterEdition] = deriveMasterEdition(nftCollectionMint);
  const treasuryWsolAta = getAssociatedTokenAddressSync(
    WSOL_MINT,
    TREASURY_PUBKEY,
  );

  return [
    { label: "nftCollectionData", address: nftCollectionData },
    { label: "nftCollectionMint", address: nftCollectionMint },
    { label: "nftCollectionMetadata", address: nftCollectionMetadata },
    { label: "nftCollectionMasterEdition", address: nftCollectionMasterEdition },
    { label: "WSOL_MINT", address: WSOL_MINT },
    { label: "TREASURY_PUBKEY", address: TREASURY_PUBKEY },
    { label: "treasuryWsolAta", address: treasuryWsolAta },
    { label: "RENT_SYSVAR", address: RENT_SYSVAR_ID },
  ];
}

async function main() {
  console.log(`RPC: ${RPC}`);
  console.log(`Sablier Lockup program: ${SABLIER_LOCKUP_PROGRAM_ID.toBase58()}`);
  const connection = new Connection(RPC, "confirmed");
  const payer = await loadKeypair();

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`  SOL balance: ${(balance / 1e9).toFixed(4)} SOL`);
  if (balance < 5_000_000) {
    throw new Error("Payer needs a little SOL (~0.01) to create + extend the table.");
  }

  const accounts = lookupAccounts();
  console.log(`\nAccounts going into the lookup table (${accounts.length}):`);
  for (const a of accounts) {
    console.log(`  ${a.label.padEnd(26)} ${a.address.toBase58()}`);
  }

  const slot = await connection.getSlot("finalized");
  const [createIx, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: slot,
    });

  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: accounts.map((a) => a.address),
  });

  console.log(`\nLookup table address: ${lookupTableAddress.toBase58()}`);
  console.log(`Sending create + extend…`);

  const tx = new Transaction().add(createIx, extendIx);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  console.log(`  tx: ${signature}`);

  // The table is only usable one slot after the extend lands. Poll until the
  // RPC can resolve it so the caller knows it's ready to reference.
  console.log(`\nWaiting for the table to become resolvable…`);
  for (let i = 0; i < 30; i++) {
    const res = await connection.getAddressLookupTable(lookupTableAddress);
    if (res.value && res.value.state.addresses.length === accounts.length) {
      console.log(`  ✓ table resolved with ${res.value.state.addresses.length} addresses`);
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n✓ DONE`);
  console.log(`Set this in the ripguard-sol Vercel project (and .env):`);
  console.log(`  NEXT_PUBLIC_LOOKUP_TABLE=${lookupTableAddress.toBase58()}`);
  console.log(
    `\nThen verify wiring with the v0 smoke test before cutover:` +
      `\n  KEYPAIR=${KEYPAIR_PATH} SOLANA_RPC="${RPC}" \\` +
      `\n  LOOKUP_TABLE=${lookupTableAddress.toBase58()} \\` +
      `\n  pnpm --filter app-sol exec tsx scripts/smoke-lock.ts`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
