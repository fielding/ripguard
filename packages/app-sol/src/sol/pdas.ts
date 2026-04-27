/**
 * Deterministic PDA derivations for the SolSab Lockup program.
 *
 * Every PDA the `create_with_durations_ll` instruction needs can be derived
 * client-side without an RPC round-trip. That lets us:
 *   - show the user the exact stream NFT mint they're about to receive
 *     before they sign
 *   - build a share-card link the moment we get the tx signature
 *   - skip extra `getAccountInfo` calls for accounts we already know
 *
 * Seed structures are pulled from the IDL — see `src/idl/sablier_lockup.json`
 * and the create-instruction account list. Keep these in sync if Sablier ever
 * publishes a new program version.
 */
import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SABLIER_LOCKUP_PROGRAM_ID } from "@/config/solsab";
import { TOKEN_METADATA_PROGRAM_ID } from "./programs";

const TEXT = (s: string) => Buffer.from(s, "utf8");

/**
 * Encode a u128 as a 16-byte little-endian Buffer for PDA seeding.
 *
 * Solana PDA seeds max out at 32 bytes per seed. Anchor encodes u128 as
 * little-endian bytes when used as a seed, so we mirror that exactly.
 */
export function u128SeedLe(salt: bigint): Buffer {
  if (salt < 0n || salt >= 1n << 128n) {
    throw new RangeError(`salt out of u128 range: ${salt}`);
  }
  const buf = Buffer.alloc(16);
  let v = salt;
  for (let i = 0; i < 16; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

/**
 * The single NFT collection PDA the program initialized at deploy time.
 * Every stream NFT belongs to this collection.
 */
export function deriveNftCollectionData(
  programId: PublicKey = SABLIER_LOCKUP_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TEXT("nft_collection_data")],
    programId,
  );
}

export function deriveNftCollectionMint(
  programId: PublicKey = SABLIER_LOCKUP_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TEXT("nft_collection_mint")],
    programId,
  );
}

/**
 * Stream NFT mint — the unique on-chain identity of a single lock.
 * Deterministic from (sender, salt). Show this to the user before they sign.
 */
export function deriveStreamNftMint(
  sender: PublicKey,
  salt: bigint,
  programId: PublicKey = SABLIER_LOCKUP_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TEXT("stream_nft_mint"), sender.toBuffer(), u128SeedLe(salt)],
    programId,
  );
}

/**
 * Stream Data PDA holding the deposit/withdraw/timing fields.
 * Owned by the SolSab Lockup program; readable for status/withdraw logic.
 */
export function deriveStreamData(
  streamNftMint: PublicKey,
  programId: PublicKey = SABLIER_LOCKUP_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TEXT("stream_data"), streamNftMint.toBuffer()],
    programId,
  );
}

/**
 * Standard SPL Associated Token Account derivation.
 *
 * Used for: `creator_ata` (the user's USDC ATA), `stream_data_ata` (where the
 * deposit lives), and the recipient's stream-NFT ATA. Anchor's `creator_ata`
 * seeds it as [owner, deposit_token_program, mint] which exactly matches
 * SPL ATA: PDA([owner, tokenProgram, mint], ATA_PROGRAM).
 */
export function deriveAta(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/**
 * Metaplex token-metadata PDA: [b"metadata", program, mint].
 */
export function deriveMetadata(
  mint: PublicKey,
  metadataProgramId: PublicKey = TOKEN_METADATA_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TEXT("metadata"), metadataProgramId.toBuffer(), mint.toBuffer()],
    metadataProgramId,
  );
}

/**
 * Metaplex master-edition PDA: [b"metadata", program, mint, b"edition"].
 */
export function deriveMasterEdition(
  mint: PublicKey,
  metadataProgramId: PublicKey = TOKEN_METADATA_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      TEXT("metadata"),
      metadataProgramId.toBuffer(),
      mint.toBuffer(),
      TEXT("edition"),
    ],
    metadataProgramId,
  );
}

/**
 * Bundle every PDA `create_with_durations_ll` needs for a given (sender, salt).
 *
 * This is the single source of truth the lock flow + share card + vault
 * lookups all consume — no need to recompute seeds in three places.
 */
export interface StreamPdaBundle {
  streamNftMint: PublicKey;
  streamData: PublicKey;
  streamDataAta: PublicKey;
  streamNftMetadata: PublicKey;
  streamNftMasterEdition: PublicKey;
  recipientStreamNftAta: PublicKey;
  creatorAta: PublicKey;
  nftCollectionData: PublicKey;
  nftCollectionMint: PublicKey;
  nftCollectionMetadata: PublicKey;
  nftCollectionMasterEdition: PublicKey;
}

export function deriveStreamPdas(params: {
  creator: PublicKey;
  sender: PublicKey;
  recipient: PublicKey;
  salt: bigint;
  depositTokenMint: PublicKey;
  depositTokenProgram?: PublicKey;
  nftTokenProgram?: PublicKey;
  programId?: PublicKey;
}): StreamPdaBundle {
  const {
    creator,
    sender,
    recipient,
    salt,
    depositTokenMint,
    depositTokenProgram = TOKEN_PROGRAM_ID,
    nftTokenProgram = TOKEN_PROGRAM_ID,
    programId = SABLIER_LOCKUP_PROGRAM_ID,
  } = params;

  const [streamNftMint] = deriveStreamNftMint(sender, salt, programId);
  const [streamData] = deriveStreamData(streamNftMint, programId);
  const [streamDataAta] = deriveAta(
    streamData,
    depositTokenMint,
    depositTokenProgram,
  );
  const [streamNftMetadata] = deriveMetadata(streamNftMint);
  const [streamNftMasterEdition] = deriveMasterEdition(streamNftMint);
  const [recipientStreamNftAta] = deriveAta(
    recipient,
    streamNftMint,
    nftTokenProgram,
  );
  const [creatorAta] = deriveAta(
    creator,
    depositTokenMint,
    depositTokenProgram,
  );
  const [nftCollectionData] = deriveNftCollectionData(programId);
  const [nftCollectionMint] = deriveNftCollectionMint(programId);
  const [nftCollectionMetadata] = deriveMetadata(nftCollectionMint);
  const [nftCollectionMasterEdition] = deriveMasterEdition(nftCollectionMint);

  return {
    streamNftMint,
    streamData,
    streamDataAta,
    streamNftMetadata,
    streamNftMasterEdition,
    recipientStreamNftAta,
    creatorAta,
    nftCollectionData,
    nftCollectionMint,
    nftCollectionMetadata,
    nftCollectionMasterEdition,
  };
}

/**
 * Generate a fresh u128 salt with crypto.getRandomValues. Used at lock time
 * so the stream NFT mint is unguessable until the user signs.
 */
export function randomSalt(): bigint {
  const bytes = new Uint8Array(16);
  // crypto is global on Node 18+ and in browsers
  crypto.getRandomValues(bytes);
  let v = 0n;
  for (let i = 15; i >= 0; i--) {
    v = (v << 8n) | BigInt(bytes[i]);
  }
  return v;
}
