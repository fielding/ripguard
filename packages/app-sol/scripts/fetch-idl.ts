/**
 * Fetch the SolSab Lockup IDL from on-chain and write it to disk.
 *
 *   pnpm fetch:idl                     → mainnet (default)
 *   NETWORK=devnet pnpm fetch:idl
 *
 * Anchor stores the IDL at a deterministic PDA derived from the program ID,
 * so we can pull it from any cluster the program is deployed on. The result
 * is a JSON file we commit alongside the source — so production builds don't
 * need an extra network round-trip and the type generator (anchor-client-gen
 * style) can run from a local file.
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, "../src/idl/sablier_lockup.json");

const PROGRAM_ID = new PublicKey(
  "4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC",
);

const NETWORK = (process.env.NETWORK ?? "mainnet-beta").toLowerCase();
const RPC_URL =
  NETWORK === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";

async function main() {
  console.log(`Fetching SolSab Lockup IDL from ${NETWORK} (${RPC_URL})…`);

  const connection = new Connection(RPC_URL, "confirmed");
  // fetchIdl only reads — it doesn't sign or send. The provider's wallet
  // is unused, so a stub is fine.
  const provider = new anchor.AnchorProvider(
    connection,
    {} as anchor.Wallet,
    {},
  );

  const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) {
    console.error(
      `No IDL account found at the expected PDA for program ${PROGRAM_ID.toBase58()}.\n` +
        `The program may not have an on-chain IDL published; you'll need to clone\n` +
        `sablier-labs/solsab and run 'anchor build' to generate target/idl/.`,
    );
    process.exit(1);
  }

  await writeFile(OUT_PATH, JSON.stringify(idl, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  // Quick sanity log so we can eyeball matchup with our hand-encoded args.
  if ("instructions" in idl && Array.isArray(idl.instructions)) {
    const create = idl.instructions.find(
      (ix: { name: string }) => ix.name === "create_with_durations_ll",
    );
    if (create) {
      console.log(
        `create_with_durations_ll args:`,
        (create as { args: { name: string; type: unknown }[] }).args.map(
          (a) => `${a.name}: ${JSON.stringify(a.type)}`,
        ),
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
