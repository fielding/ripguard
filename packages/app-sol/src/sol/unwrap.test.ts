import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { buildUnwrapWsolIxs, wsolAta } from "./unwrap";

describe("unwrap wSOL", () => {
  const owner = Keypair.generate().publicKey;

  it("derives the canonical wSOL ATA for the owner", () => {
    expect(wsolAta(owner).equals(getAssociatedTokenAddressSync(NATIVE_MINT, owner))).toBe(
      true,
    );
  });

  it("closes the owner's wSOL ATA, returning lamports to the owner", () => {
    const ixs = buildUnwrapWsolIxs(owner);
    expect(ixs).toHaveLength(1);

    const close = ixs[0];
    expect(close.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);

    // closeAccount keys: [account, destination, authority].
    const [account, destination, authority] = close.keys;
    expect(account.pubkey.equals(wsolAta(owner))).toBe(true);
    expect(account.isWritable).toBe(true);
    // Both the lamport destination and the close authority are the owner —
    // the unwrapped SOL (balance + rent) lands back in the owner's wallet.
    expect(destination.pubkey.equals(owner)).toBe(true);
    expect(authority.pubkey.equals(owner)).toBe(true);
    expect(authority.isSigner).toBe(true);
  });
});
