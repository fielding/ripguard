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
  TransactionMessage,
  VersionedTransaction,
  type Connection,
  type TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { LOOKUP_TABLE_ADDRESS } from "@/config/solsab";

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

type LockSender = Pick<
  WalletContextState,
  "publicKey" | "signTransaction" | "sendTransaction"
>;

interface LockHooks {
  /** Fired right before the wallet is asked to sign/send. */
  onSign?: () => void;
  /** Fired once we have a signature, before confirmation. */
  onSent?: (signature: string) => void;
}

/**
 * Send the create/lock tx. Two paths:
 *
 * 1. **v0 + ALT (preferred):** when `LOOKUP_TABLE_ADDRESS` is configured and
 *    the table loads, compile a v0 message against it and hand the wallet an
 *    UNSIGNED `VersionedTransaction` via `sendTransaction` — so Lighthouse can
 *    inject guard instructions, and the compressed accounts leave room for
 *    them. The lock tx is account-heavy, so this is the path that clears the
 *    Blowfish warning.
 *
 * 2. **Legacy fallback (unchanged behavior):** no table configured, or the
 *    table can't be loaded → assemble a legacy `Transaction`, sign locally,
 *    and broadcast through our Helius endpoint (stake-weighted landing). This
 *    is the exact path the app shipped with, so an unconfigured/unavailable
 *    ALT can never break lock creation.
 */
export async function sendLockTx(
  wallet: LockSender,
  connection: Connection,
  instructions: TransactionInstruction[],
  hooks?: LockHooks,
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error("Connect a wallet first.");
  }

  // --- Path 1: v0 + Address Lookup Table ------------------------------------
  if (LOOKUP_TABLE_ADDRESS) {
    const lookupTable = await connection
      .getAddressLookupTable(LOOKUP_TABLE_ADDRESS)
      .then((res) => res.value)
      .catch(() => null);

    if (lookupTable) {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      const message = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message([lookupTable]);
      const vtx = new VersionedTransaction(message);

      // Unsigned v0 tx → wallet signs and sends (signAndSendTransaction),
      // the path Lighthouse needs to add guards.
      hooks?.onSign?.();
      const signature = await wallet.sendTransaction(vtx, connection, {
        maxRetries: 5,
        preflightCommitment: "confirmed",
      });
      hooks?.onSent?.(signature);
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      return signature;
    }

    // Table configured but unreadable — don't fail the lock, drop to legacy.
    console.warn(
      "[ripguard] lookup table unavailable; using legacy send path",
    );
  }

  // --- Path 2: legacy sign + Helius broadcast (preserved verbatim) ----------
  if (!wallet.signTransaction) {
    throw new Error("Wallet does not support signTransaction.");
  }
  const tx = new Transaction();
  for (const ix of instructions) tx.add(ix);
  // Use `processed` for the blockhash so we get the freshest possible tip —
  // buys ~30 extra slots of validity vs `confirmed`, which the Phantom
  // warning popup eats up while the user reads it.
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("processed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  // Have Phantom sign only — DON'T let Phantom broadcast. Phantom's RPC isn't
  // stake-weighted; under any contention, leaders silently drop our tx and we
  // hit "block height exceeded" without it ever reaching the chain.
  // Broadcasting through our own Helius endpoint gets us reliable landing.
  hooks?.onSign?.();
  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    maxRetries: 5,
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  hooks?.onSent?.(signature);
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}
