import { describe, it, expect } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { buildWithdrawMaxTx } from "./withdraw";
import { deriveTreasury } from "./pdas";
import { SABLIER_LOCKUP_PROGRAM_ID } from "@/config/solsab";

// buildWithdrawMaxTx fetches the Treasury PDA (for the chainlink fee feeds)
// and then assembles the withdraw ixs offline. We stub only the Treasury
// account read so the real instruction assembly — including the SOL
// self-unwrap (idempotent wSOL ATA create + close around withdraw_max) — runs
// and can be asserted on. That self-unwrap is the custody-critical bit: a
// dropped close ix would strand the claimed SOL as wrapped.

// Treasury account = 8-byte discriminator + bump(u8) + 3 pubkeys, per the IDL.
const TREASURY_DISCRIMINATOR = Buffer.from([238, 239, 123, 238, 89, 1, 168, 253]);

function fakeTreasuryAccount() {
  const data = Buffer.concat([
    TREASURY_DISCRIMINATOR,
    Buffer.from([255]), // bump
    Keypair.generate().publicKey.toBuffer(), // fee_collector
    Keypair.generate().publicKey.toBuffer(), // chainlink_program
    Keypair.generate().publicKey.toBuffer(), // chainlink_sol_usd_feed
  ]);
  return {
    data,
    owner: SABLIER_LOCKUP_PROGRAM_ID,
    lamports: 1_000_000,
    executable: false,
    rentEpoch: 0,
  };
}

function makeProviderWithTreasury(signer: PublicKey): anchor.AnchorProvider {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const [treasuryPda] = deriveTreasury();
  const infoFor = (address: PublicKey) =>
    address.equals(treasuryPda) ? fakeTreasuryAccount() : null;
  // Override every account-read path Anchor might use so no request escapes
  // to the (offline) RPC. `.fetch()` resolves through one of these.
  const conn = connection as unknown as Record<string, unknown>;
  conn.getAccountInfo = async (address: PublicKey) => infoFor(address);
  conn.getAccountInfoAndContext = async (address: PublicKey) => ({
    context: { slot: 0 },
    value: infoFor(address),
  });
  conn.getMultipleAccountsInfo = async (addresses: PublicKey[]) =>
    addresses.map(infoFor);
  const wallet = {
    publicKey: signer,
    signTransaction: async () => {
      throw new Error("not used");
    },
    signAllTransactions: async () => {
      throw new Error("not used");
    },
  } as unknown as anchor.Wallet;
  return new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

const SIGNER = Keypair.generate().publicKey;
const STREAM_NFT_MINT = Keypair.generate().publicKey;

describe("buildWithdrawMaxTx", () => {
  it("SOL stream: wraps the claim in an idempotent wSOL ATA create + close (self-unwrap)", async () => {
    const provider = makeProviderWithTreasury(SIGNER);
    const { instructions } = await buildWithdrawMaxTx({
      provider,
      signer: SIGNER,
      streamNftMint: STREAM_NFT_MINT,
      depositedTokenMint: NATIVE_MINT,
    });

    // 2 compute-budget + ATA create + withdraw_max + close = 5 ixs.
    expect(instructions).toHaveLength(5);

    const recipientWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, SIGNER);

    // An idempotent ATA create precedes withdraw (ATA program).
    const ataCreate = instructions.find((ix) =>
      ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID),
    );
    expect(ataCreate).toBeDefined();

    // The withdraw_max ix runs against the Sablier program.
    const withdrawIdx = instructions.findIndex((ix) =>
      ix.programId.equals(SABLIER_LOCKUP_PROGRAM_ID),
    );
    expect(withdrawIdx).toBeGreaterThanOrEqual(0);

    // A closeAccount (token program) is the LAST ix and targets the wSOL ATA —
    // closing it sweeps the claimed wSOL back to the owner as native SOL.
    const last = instructions[instructions.length - 1];
    expect(last.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(last.keys[0].pubkey.equals(recipientWsolAta)).toBe(true);
    expect(last.keys[1].pubkey.equals(SIGNER)).toBe(true); // lamport destination
    // close comes strictly after withdraw_max.
    expect(instructions.length - 1).toBeGreaterThan(withdrawIdx);
  });

  it("non-SOL stream: no wrap/unwrap ixs, just withdraw_max", async () => {
    const provider = makeProviderWithTreasury(SIGNER);
    const otherMint = Keypair.generate().publicKey;
    const { instructions } = await buildWithdrawMaxTx({
      provider,
      signer: SIGNER,
      streamNftMint: STREAM_NFT_MINT,
      depositedTokenMint: otherMint,
    });

    // 2 compute-budget + withdraw_max only.
    expect(instructions).toHaveLength(3);
    expect(
      instructions.some((ix) =>
        ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID),
      ),
    ).toBe(false);
    // No closeAccount.
    expect(
      instructions.filter((ix) => ix.programId.equals(TOKEN_PROGRAM_ID)),
    ).toHaveLength(0);
    expect(
      instructions.some((ix) => ix.programId.equals(SABLIER_LOCKUP_PROGRAM_ID)),
    ).toBe(true);
  });
});
