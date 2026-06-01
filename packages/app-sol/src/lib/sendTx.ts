/**
 * Send a transaction the Lighthouse-compatible way: hand the wallet an
 * UNSIGNED transaction via its `sendTransaction` (which uses Phantom's
 * `signAndSendTransaction` under the hood) so Blowfish/Lighthouse can
 * inject guard instructions before the wallet signs and broadcasts.
 *
 * Tradeoff vs our other path (sign locally + broadcast through Helius):
 * the wallet now broadcasts, so we lose stake-weighted forwarding. That
 * is acceptable for small, low-contention txs (claim, unwrap). The heavy
 * create/lock tx keeps its own Helius send until it is migrated to a v0
 * tx with an address lookup table that leaves room for guard injection.
 */
import {
  Transaction,
  type Connection,
  type TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

type Sender = Pick<WalletContextState, "publicKey" | "sendTransaction">;

export async function sendViaWallet(
  wallet: Sender,
  connection: Connection,
  instructions: TransactionInstruction[],
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error("Connect a wallet first.");
  }

  const tx = new Transaction();
  for (const ix of instructions) tx.add(ix);

  // Set our own blockhash + fee payer so confirmation is deterministic.
  // Phantom keeps the provided blockhash when injecting guards, so the
  // (blockhash, lastValidBlockHeight) pair stays valid for confirm.
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  // Unsigned tx → wallet signs AND sends (signAndSendTransaction), which
  // is the path Lighthouse needs to add its guard instructions.
  const signature = await wallet.sendTransaction(tx, connection, {
    maxRetries: 5,
    preflightCommitment: "confirmed",
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return signature;
}
