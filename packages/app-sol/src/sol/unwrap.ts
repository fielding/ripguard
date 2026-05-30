/**
 * Unwrapping wrapped SOL (wSOL) back into native SOL.
 *
 * On Solana there is no dedicated "unwrap" instruction. wSOL is just an
 * SPL token account holding the native mint (So111…112). Closing that
 * token account IS the unwrap: every lamport inside it — the wrapped
 * balance plus the ~0.00204 SOL rent reserve — is swept to the owner as
 * native SOL. So a full unwrap is a single `closeAccount` instruction.
 */
import {
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";

/** The owner's associated token account for wrapped SOL. */
export function wsolAta(owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(NATIVE_MINT, owner);
}

/**
 * Build the instruction(s) that unwrap all of `owner`'s wSOL back to
 * native SOL by closing their wSOL ATA. The recovered lamports (wrapped
 * balance + rent) land in `owner`'s native balance.
 *
 * Assumes the wSOL ATA exists — callers should only invoke this when a
 * non-zero wSOL balance has been observed.
 */
export function buildUnwrapWsolIxs(owner: PublicKey): TransactionInstruction[] {
  return [createCloseAccountInstruction(wsolAta(owner), owner, owner)];
}
