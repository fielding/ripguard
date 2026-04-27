/**
 * Hardcoded program addresses we interact with on Solana.
 *
 * The SolSab Lockup program ID lives in `config/solsab.ts`. The well-known
 * Solana / SPL / Metaplex program IDs live here so they're not interleaved
 * with our env-driven config.
 */
import { PublicKey } from "@solana/web3.js";

// Metaplex token-metadata program. Sablier wraps each stream in a Metaplex
// NFT, so we need this for the stream/collection metadata PDAs.
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

// Rent sysvar. Some legacy instructions still require it as an explicit account.
export const RENT_SYSVAR_ID = new PublicKey(
  "SysvarRent111111111111111111111111111111111",
);
