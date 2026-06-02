/**
 * Generate a fresh Solana keypair file (standard CLI byte-array format) to use
 * as the Address Lookup Table authority/payer. Prints ONLY the public address;
 * the secret never leaves the written file.
 *
 *   pnpm --filter app-sol exec tsx scripts/gen-keypair.ts
 *   OUT=~/.config/solana/ripguard-alt-authority.json pnpm --filter app-sol exec tsx scripts/gen-keypair.ts
 *
 * Next steps after running:
 *   1. Send ~0.02 SOL to the printed address from Phantom (mainnet).
 *   2. KEYPAIR=<that file> SOLANA_RPC=<mainnet> \
 *      pnpm --filter app-sol exec tsx scripts/create-lookup-table.ts
 *
 * Safety: refuses to overwrite an existing file (never clobber a key), creates
 * the parent dir if needed, and writes the file 0600 (owner read/write only).
 */

import { Keypair } from "@solana/web3.js";
import { mkdir, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const OUT =
  process.env.OUT ??
  join(homedir(), ".config/solana/ripguard-alt-authority.json");

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (await fileExists(OUT)) {
    throw new Error(
      `Refusing to overwrite existing file: ${OUT}\n` +
        `Pass OUT=/some/other/path.json if you really want a new one.`,
    );
  }

  const kp = Keypair.generate();

  await mkdir(dirname(OUT), { recursive: true });
  // Standard Solana CLI format: JSON array of the 64 secret-key bytes.
  await writeFile(OUT, JSON.stringify(Array.from(kp.secretKey)), {
    mode: 0o600,
  });

  console.log(`✓ Wrote new keypair to ${OUT} (mode 0600)`);
  console.log(`  public address: ${kp.publicKey.toBase58()}`);
  console.log(`\nNext:`);
  console.log(`  1. Send ~0.02 SOL to that address from Phantom (mainnet).`);
  console.log(`  2. Back up this file somewhere safe — it's the ALT authority.`);
  console.log(
    `  3. KEYPAIR=${OUT} SOLANA_RPC="<mainnet rpc>" \\` +
      `\n     pnpm --filter app-sol exec tsx scripts/create-lookup-table.ts`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
