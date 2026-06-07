import { describe, it, expect, vi } from "vitest";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
} from "@solana/spl-token";

import { buildLockTx } from "./lock";
import { deriveAta, deriveStreamPdas } from "./pdas";
import { SABLIER_LOCKUP_PROGRAM_ID, WSOL_MINT, ZERO_PUBKEY } from "@/config/solsab";

// buildLockTx assembles instructions via Anchor's `.instruction()` builder,
// which is fully offline — it derives PDAs and serializes accounts without an
// RPC round-trip. So we can build the real instruction list against a dummy
// connection and assert on the emitted ix keys/order, which is exactly the
// fund-moving wiring the pure-math tests can't see.

function makeProvider(signer: PublicKey): anchor.AnchorProvider {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
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
const TREASURY = Keypair.generate().publicKey;
const SALT = 123456789n;
const DEPOSIT = 1_000_000n; // 0.001 SOL

const baseArgs = {
  signer: SIGNER,
  recipient: SIGNER, // RipGuard's locked-self pattern
  depositAmount: DEPOSIT,
  cliffSeconds: 0,
  totalSeconds: 3600,
  salt: SALT,
};

function countByProgram(
  instructions: { programId: PublicKey }[],
  programId: PublicKey,
): number {
  return instructions.filter((ix) => ix.programId.equals(programId)).length;
}

describe("buildLockTx", () => {
  it("with no treasury: wraps SOL and calls Sablier, no fee transfer", async () => {
    const provider = makeProvider(SIGNER);
    const { instructions, feeActive, feeAmount, netDepositAmount } =
      await buildLockTx({ ...baseArgs, provider, treasury: ZERO_PUBKEY });

    // 2 compute-budget + 1 ATA create + (transfer + syncNative wrap) + create
    // 2 compute-budget + ATA create + (transfer + syncNative wrap) + create
    // + closeAccount (reclaims the wSOL ATA rent).
    expect(instructions).toHaveLength(7);
    expect(feeActive).toBe(false);
    expect(feeAmount).toBe(0n);
    expect(netDepositAmount).toBe(DEPOSIT);

    // Two compute-budget ixs lead the tx.
    expect(countByProgram(instructions, ComputeBudgetProgram.programId)).toBe(2);
    // Exactly one Sablier create ix.
    expect(countByProgram(instructions, SABLIER_LOCKUP_PROGRAM_ID)).toBe(1);
    // The wSOL wrap: a System transfer of the full deposit into the creator ATA.
    const pdas = deriveStreamPdas({
      creator: SIGNER,
      sender: SIGNER,
      recipient: SIGNER,
      salt: SALT,
      depositTokenMint: WSOL_MINT,
    });
    const transfer = instructions.find((ix) =>
      ix.programId.equals(SystemProgram.programId),
    );
    expect(transfer).toBeDefined();
    expect(
      transfer!.keys.some((k) => k.pubkey.equals(pdas.creatorAta)),
    ).toBe(true);
    // Token program rides syncNative + the trailing closeAccount.
    expect(countByProgram(instructions, TOKEN_PROGRAM_ID)).toBe(2);
    // The LAST ix closes the creator wSOL ATA (rent back to signer).
    const last = instructions[instructions.length - 1];
    expect(last.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(last.keys[0].pubkey.equals(pdas.creatorAta)).toBe(true); // account
    expect(last.keys[1].pubkey.equals(SIGNER)).toBe(true); // lamport destination
  });

  it("with a treasury configured: inserts the broker-fee pre-transfer and nets the deposit", async () => {
    // computeBrokerFee gates on the env-driven TREASURY_PUBKEY (not the param),
    // so the fee path only activates when the treasury env is set at module
    // load. Re-import the builder with the env stubbed to exercise it.
    vi.stubEnv("NEXT_PUBLIC_TREASURY_PUBKEY", TREASURY.toBase58());
    vi.resetModules();
    const { buildLockTx: build } = await import("./lock");

    const provider = makeProvider(SIGNER);
    const { instructions, feeActive, feeAmount, netDepositAmount } = await build(
      { ...baseArgs, provider }, // treasury param defaults to the env value
    );

    // adds: treasury-ATA idempotent create + fee transfer → 9 ixs
    // (7 from the no-fee case + those two).
    expect(instructions).toHaveLength(9);
    expect(feeActive).toBe(true);
    expect(feeAmount).toBe(5_000n); // 0.5% of 1_000_000
    expect(netDepositAmount).toBe(DEPOSIT - 5_000n);

    // The fee transfer moves tokens to the treasury's wSOL ATA.
    const [treasuryAta] = deriveAta(TREASURY, WSOL_MINT);
    const tokenIxs = instructions.filter((ix) =>
      ix.programId.equals(TOKEN_PROGRAM_ID),
    );
    // syncNative + fee transfer + trailing closeAccount ride the token program.
    expect(tokenIxs.length).toBe(3);
    const feeTransfer = tokenIxs.find((ix) =>
      ix.keys.some((k) => k.pubkey.equals(treasuryAta)),
    );
    expect(feeTransfer).toBeDefined();

    // Two ATA-program idempotent creates (creator ATA + treasury ATA).
    expect(countByProgram(instructions, ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(2);

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("threads creator/recipient and the wSOL mint into the Sablier create ix", async () => {
    const provider = makeProvider(SIGNER);
    const { instructions } = await buildLockTx({
      ...baseArgs,
      provider,
      treasury: ZERO_PUBKEY,
    });

    const createIx = instructions.find((ix) =>
      ix.programId.equals(SABLIER_LOCKUP_PROGRAM_ID),
    );
    expect(createIx).toBeDefined();
    const keys = createIx!.keys.map((k) => k.pubkey.toBase58());
    // Signer is present and is a signer on the create ix.
    const signerMeta = createIx!.keys.find((k) => k.pubkey.equals(SIGNER));
    expect(signerMeta?.isSigner).toBe(true);
    // The deposit mint is wSOL.
    expect(keys).toContain(NATIVE_MINT.toBase58());
  });

  it("rejects a non-positive deposit", async () => {
    const provider = makeProvider(SIGNER);
    await expect(
      buildLockTx({ ...baseArgs, provider, depositAmount: 0n }),
    ).rejects.toThrow();
  });

  it("rejects a cliff that is not shorter than the total", async () => {
    const provider = makeProvider(SIGNER);
    await expect(
      buildLockTx({
        ...baseArgs,
        provider,
        cliffSeconds: 3600,
        totalSeconds: 3600,
      }),
    ).rejects.toThrow();
  });
});
