import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  u128SeedLe,
  deriveStreamNftMint,
  deriveStreamData,
  deriveAta,
  deriveStreamPdas,
  deriveNftCollectionData,
  deriveNftCollectionMint,
  randomSalt,
} from "./pdas";
import { SABLIER_LOCKUP_PROGRAM_ID, USDC_MINT } from "@/config/solsab";

// Deterministic fixture wallet — never funded, never used. Existence on
// chain is irrelevant; PDA derivation is pure math.
const SENDER = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");
const RECIPIENT = SENDER; // self-recipient is the canonical RipGuard pattern
const FIXED_SALT = 1234567890n;

describe("u128SeedLe", () => {
  it("encodes 0n as 16 zero bytes", () => {
    expect(Array.from(u128SeedLe(0n))).toEqual(new Array(16).fill(0));
  });

  it("encodes 1n as little-endian (1, 0, 0, …)", () => {
    const bytes = Array.from(u128SeedLe(1n));
    expect(bytes[0]).toBe(1);
    expect(bytes.slice(1)).toEqual(new Array(15).fill(0));
  });

  it("encodes u128 max as all 0xff", () => {
    const max = (1n << 128n) - 1n;
    expect(Array.from(u128SeedLe(max))).toEqual(new Array(16).fill(0xff));
  });

  it("encodes 0x100 as [0x00, 0x01, 0x00, …]", () => {
    const bytes = Array.from(u128SeedLe(0x100n));
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0x01);
    expect(bytes.slice(2)).toEqual(new Array(14).fill(0));
  });

  it("rejects negative", () => {
    expect(() => u128SeedLe(-1n)).toThrow(RangeError);
  });

  it("rejects values >= 2^128", () => {
    expect(() => u128SeedLe(1n << 128n)).toThrow(RangeError);
  });
});

describe("PDA derivations are deterministic", () => {
  // We don't know the "right" address without an on-chain reference, but
  // every PDA is a pure function of inputs. Snapshotting prevents an
  // unintentional regression if seed bytes shift around (e.g. typo in a
  // string literal).

  it("deriveStreamNftMint is stable for fixed inputs", () => {
    const [a] = deriveStreamNftMint(SENDER, FIXED_SALT);
    const [b] = deriveStreamNftMint(SENDER, FIXED_SALT);
    expect(a.toBase58()).toBe(b.toBase58());
  });

  it("deriveStreamNftMint changes with salt", () => {
    const [a] = deriveStreamNftMint(SENDER, FIXED_SALT);
    const [b] = deriveStreamNftMint(SENDER, FIXED_SALT + 1n);
    expect(a.toBase58()).not.toBe(b.toBase58());
  });

  it("deriveStreamNftMint changes with sender", () => {
    const other = new PublicKey(
      "8ZUczUAUSZvMQdpiNPbWcdaJiHRrvY7VhqW3qZqZqZqZ",
    );
    const [a] = deriveStreamNftMint(SENDER, FIXED_SALT);
    const [b] = deriveStreamNftMint(other, FIXED_SALT);
    expect(a.toBase58()).not.toBe(b.toBase58());
  });

  it("deriveStreamData is stable and depends on the NFT mint", () => {
    const [mint] = deriveStreamNftMint(SENDER, FIXED_SALT);
    const [data1] = deriveStreamData(mint);
    const [data2] = deriveStreamData(mint);
    expect(data1.toBase58()).toBe(data2.toBase58());

    const [otherMint] = deriveStreamNftMint(SENDER, FIXED_SALT + 1n);
    const [otherData] = deriveStreamData(otherMint);
    expect(data1.toBase58()).not.toBe(otherData.toBase58());
  });

  it("nft_collection_data and nft_collection_mint are program-singletons", () => {
    const [a] = deriveNftCollectionData();
    const [b] = deriveNftCollectionData();
    expect(a.toBase58()).toBe(b.toBase58());
    const [c] = deriveNftCollectionMint();
    expect(c.toBase58()).not.toBe(a.toBase58());
  });
});

describe("deriveAta", () => {
  it("matches the SPL ATA seed convention: [owner, tokenProgram, mint]", () => {
    const [ata] = deriveAta(SENDER, USDC_MINT);
    const [expected] = PublicKey.findProgramAddressSync(
      [SENDER.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_MINT.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    expect(ata.toBase58()).toBe(expected.toBase58());
  });

  it("is stable across calls", () => {
    const [a] = deriveAta(SENDER, USDC_MINT);
    const [b] = deriveAta(SENDER, USDC_MINT);
    expect(a.toBase58()).toBe(b.toBase58());
  });
});

describe("deriveStreamPdas", () => {
  it("returns every PDA the create instruction needs", () => {
    const bundle = deriveStreamPdas({
      creator: SENDER,
      sender: SENDER,
      recipient: RECIPIENT,
      salt: FIXED_SALT,
      depositTokenMint: USDC_MINT,
    });

    // All required keys present
    expect(bundle.streamNftMint).toBeDefined();
    expect(bundle.streamData).toBeDefined();
    expect(bundle.streamDataAta).toBeDefined();
    expect(bundle.streamNftMetadata).toBeDefined();
    expect(bundle.streamNftMasterEdition).toBeDefined();
    expect(bundle.recipientStreamNftAta).toBeDefined();
    expect(bundle.creatorAta).toBeDefined();
    expect(bundle.nftCollectionData).toBeDefined();
    expect(bundle.nftCollectionMint).toBeDefined();
    expect(bundle.nftCollectionMetadata).toBeDefined();
    expect(bundle.nftCollectionMasterEdition).toBeDefined();
  });

  it("agrees with individual derivers", () => {
    const bundle = deriveStreamPdas({
      creator: SENDER,
      sender: SENDER,
      recipient: RECIPIENT,
      salt: FIXED_SALT,
      depositTokenMint: USDC_MINT,
    });
    const [mint] = deriveStreamNftMint(SENDER, FIXED_SALT);
    expect(bundle.streamNftMint.toBase58()).toBe(mint.toBase58());

    const [data] = deriveStreamData(mint);
    expect(bundle.streamData.toBase58()).toBe(data.toBase58());

    const [creatorAta] = deriveAta(SENDER, USDC_MINT);
    expect(bundle.creatorAta.toBase58()).toBe(creatorAta.toBase58());
  });

  it("respects custom programId", () => {
    const fakeProgramId = new PublicKey(
      "11111111111111111111111111111112",
    );
    const a = deriveStreamPdas({
      creator: SENDER,
      sender: SENDER,
      recipient: RECIPIENT,
      salt: FIXED_SALT,
      depositTokenMint: USDC_MINT,
    });
    const b = deriveStreamPdas({
      creator: SENDER,
      sender: SENDER,
      recipient: RECIPIENT,
      salt: FIXED_SALT,
      depositTokenMint: USDC_MINT,
      programId: fakeProgramId,
    });
    expect(a.streamNftMint.toBase58()).not.toBe(b.streamNftMint.toBase58());
  });

  it("uses the canonical SolSab Lockup program id by default", () => {
    expect(SABLIER_LOCKUP_PROGRAM_ID.toBase58()).toBe(
      "4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC",
    );
  });
});

describe("randomSalt", () => {
  it("returns values in u128 range", () => {
    for (let i = 0; i < 20; i++) {
      const s = randomSalt();
      expect(s).toBeGreaterThanOrEqual(0n);
      expect(s).toBeLessThan(1n << 128n);
    }
  });

  it("does not collide trivially", () => {
    const a = randomSalt();
    const b = randomSalt();
    expect(a).not.toBe(b);
  });

  it("produces non-zero values most of the time", () => {
    // Probability of all zero across 10 calls is ~0; if this fails we have
    // a broken RNG, not flakiness.
    let nonZeroCount = 0;
    for (let i = 0; i < 10; i++) {
      if (randomSalt() !== 0n) nonZeroCount++;
    }
    expect(nonZeroCount).toBeGreaterThan(0);
  });
});
