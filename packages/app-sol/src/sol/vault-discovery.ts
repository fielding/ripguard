/**
 * Discover the user's locks on the SolSab Lockup program.
 *
 * Strategy: query every StreamData account on the program, filter by
 * `sender == user`. Works for RipGuard's locked-self pattern (sender
 * always == recipient). For gifted locks (someone else as sender, you as
 * recipient), discovery would need to scan NFTs in the SolSab collection
 * the user owns instead — out of scope for MVP.
 *
 * Optimization opportunity: switch from no-filter `.all()` to a memcmp
 * filter targeting the `sender` field at byte offset 123 (after 8-byte
 * Anchor discriminator + 40-byte amounts + 32-byte mint + 1-byte bump
 * + 16-byte salt + 1-byte cancelable + 1-byte depleted + 24-byte
 * timestamps). For MVP we keep it simple; if devnet/mainnet datasets
 * grow this becomes important.
 */
import { type AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { type PublicKey } from "@solana/web3.js";
import idlJson from "@/idl/sablier_lockup.json";
import type { Idl } from "@coral-xyz/anchor";
import type { StreamSnapshot } from "./vault-math";

const SABLIER_LOCKUP_IDL = idlJson as unknown as Idl;

export interface DiscoveredStream {
  /** PDA address of the StreamData account. */
  streamData: PublicKey;
  /** Stream NFT mint = stream identity, used for vault links + withdraw. */
  streamNftMint: PublicKey;
  /** Sablier sender (RipGuard pattern: same as the connected user). */
  sender: PublicKey;
  /** USDC mint at the time of lock. Used for withdraw account wiring. */
  depositedTokenMint: PublicKey;
  /** Pure snapshot for status / withdrawable / progress math. */
  snapshot: StreamSnapshot;
  /** Raw u128 salt — useful for debugging + share-card stream IDs. */
  salt: bigint;
}

interface RawStreamAccount {
  amounts: {
    startUnlock: BN;
    cliffUnlock: BN;
    deposited: BN;
    refunded: BN;
    withdrawn: BN;
  };
  depositedTokenMint: PublicKey;
  bump: number;
  salt: BN;
  isCancelable: boolean;
  isDepleted: boolean;
  timestamps: { cliff: BN; end: BN; start: BN };
  sender: PublicKey;
  wasCanceled: boolean;
}

function bnToBigInt(bn: BN): bigint {
  return BigInt(bn.toString());
}

function toSnapshot(raw: RawStreamAccount): StreamSnapshot {
  return {
    startTime: bnToBigInt(raw.timestamps.start),
    cliffTime: bnToBigInt(raw.timestamps.cliff),
    endTime: bnToBigInt(raw.timestamps.end),
    deposited: bnToBigInt(raw.amounts.deposited),
    startUnlock: bnToBigInt(raw.amounts.startUnlock),
    cliffUnlock: bnToBigInt(raw.amounts.cliffUnlock),
    withdrawn: bnToBigInt(raw.amounts.withdrawn),
    refunded: bnToBigInt(raw.amounts.refunded),
    isCancelable: raw.isCancelable,
    isDepleted: raw.isDepleted,
    wasCanceled: raw.wasCanceled,
  };
}

/**
 * Re-derive the stream NFT mint from sender + salt.
 *
 * StreamData doesn't store the NFT mint directly; the relationship is
 * (sender, salt) → mint via PDA derivation. We import locally rather than
 * re-hop through a separate file so the discovery module is self-contained
 * for testing.
 */
async function streamNftMintFromRaw(
  raw: RawStreamAccount,
): Promise<PublicKey> {
  const { deriveStreamNftMint } = await import("./pdas");
  const [mint] = deriveStreamNftMint(raw.sender, bnToBigInt(raw.salt));
  return mint;
}

/**
 * Fetch every stream where `sender == user`. Returns an empty array if
 * there are none (common for first-time users). RPC errors propagate.
 */
export async function getStreamsForSender(
  provider: AnchorProvider,
  sender: PublicKey,
): Promise<DiscoveredStream[]> {
  const program = new Program(SABLIER_LOCKUP_IDL, provider);

  // .all() returns every StreamData on the program. For MVP we filter
  // client-side; switch to memcmp once dataset size matters.
  // The IDL is typed as the generic Anchor `Idl`, so the per-account
  // accessor isn't statically known — cast through unknown.
  const accountNs = program.account as unknown as {
    streamData: {
      all(): Promise<Array<{ publicKey: PublicKey; account: RawStreamAccount }>>;
    };
  };
  const all = await accountNs.streamData.all();

  const mine = all.filter((row) => row.account.sender.equals(sender));

  return Promise.all(
    mine.map(async (row) => {
      const streamNftMint = await streamNftMintFromRaw(row.account);
      return {
        streamData: row.publicKey,
        streamNftMint,
        sender: row.account.sender,
        depositedTokenMint: row.account.depositedTokenMint,
        snapshot: toSnapshot(row.account),
        salt: bnToBigInt(row.account.salt),
      };
    }),
  );
}
