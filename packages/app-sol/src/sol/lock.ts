/**
 * Build the multi-instruction transaction that creates a RipGuard lock
 * on Solana.
 *
 * Two instructions in one transaction (one signature for the user):
 *
 *   1. (optional) splTransfer  user_ata → treasury_ata, fee = deposit*0.005
 *   2. create_with_durations_ll on the SolSab Lockup program
 *
 * The pre-transfer is the TS-skim that stands in for Sablier's broker-fee
 * arg on EVM (Solana's program has no equivalent — see project_solana_phase0
 * memory). We compute the fee, transfer it from the user's ATA to the
 * RipGuard treasury's ATA, and call Sablier with the post-fee net amount.
 *
 * If the treasury isn't configured (devnet default), the fee is 0 and the
 * pre-transfer is omitted entirely.
 *
 * The caller is responsible for any ATA-bootstrapping ixs (creating
 * `creator_ata` or the treasury ATA on first-time use). We surface the
 * required ATAs via `deriveStreamPdas` so the caller can check existence
 * before signing.
 */
import { type AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  type TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import {
  PRIORITY_FEE_MICRO_LAMPORTS,
  SABLIER_LOCKUP_PROGRAM_ID,
  TREASURY_PUBKEY,
  WSOL_MINT,
  ZERO_PUBKEY,
  computeBrokerFee,
} from "@/config/solsab";
import { deriveAta, deriveStreamPdas, type StreamPdaBundle } from "./pdas";
// Path-style import so we can re-fetch and overwrite without breaking the
// runtime — the JSON is data, not code.
import idlJson from "@/idl/sablier_lockup.json";

// The IDL JSON shape isn't strictly typed; Anchor's Program accepts any
// JSON-shaped Idl at runtime. Casting through `unknown` keeps TS happy
// without losing too much expressivity at the call site.
import type { Idl } from "@coral-xyz/anchor";
const SABLIER_LOCKUP_IDL = idlJson as unknown as Idl;

/**
 * What the caller hands us. All math (fee split, salt, PDA derivation) we
 * own — the caller just supplies wallet context + the user's intent.
 */
export interface BuildLockTxArgs {
  provider: AnchorProvider;
  /** The wallet signing the transaction. Doubles as creator + sender. */
  signer: PublicKey;
  /** Stream recipient (the NFT owner). Self-recipient is RipGuard's pattern. */
  recipient: PublicKey;
  /** Total USDC deposit in token base units (6 decimals). Pre-fee. */
  depositAmount: bigint;
  /** Cliff duration in seconds, 0 for no cliff. */
  cliffSeconds: number;
  /** Total stream duration in seconds. Must be > cliffSeconds when there's a cliff. */
  totalSeconds: number;
  /** Random u128 salt. Use `randomSalt()` for production calls. */
  salt: bigint;
  /** Override deposit token mint. Defaults to the network's USDC mint. */
  depositTokenMint?: PublicKey;
  /** Override treasury. Defaults to NEXT_PUBLIC_TREASURY_PUBKEY (or zero pubkey). */
  treasury?: PublicKey;
}

export interface BuildLockTxResult {
  /** Ordered list of instructions to drop into a Transaction. */
  instructions: TransactionInstruction[];
  /** Net amount actually deposited into the Sablier stream (deposit - fee). */
  netDepositAmount: bigint;
  /** Fee skimmed to the treasury, in deposit-token base units. */
  feeAmount: bigint;
  /** Every PDA the create instruction needs — pre-derived for the caller. */
  pdas: StreamPdaBundle;
  /** Whether the treasury fee was active. False means devnet/no-treasury. */
  feeActive: boolean;
}

/**
 * Default Anchor program client for the SolSab Lockup. Handy if you only
 * need the typed methods.builder() pipeline; for tx-only flows
 * `buildLockTx` constructs the ixs directly.
 */
export function getLockupProgram(provider: AnchorProvider) {
  return new Program(SABLIER_LOCKUP_IDL, provider);
}

/**
 * Assemble the lock tx. Pure ix construction — does NOT send.
 */
export async function buildLockTx(
  args: BuildLockTxArgs,
): Promise<BuildLockTxResult> {
  const {
    provider,
    signer,
    recipient,
    depositAmount,
    cliffSeconds,
    totalSeconds,
    salt,
    depositTokenMint = WSOL_MINT,
    treasury = TREASURY_PUBKEY,
  } = args;

  // Wrapping native SOL means we transfer lamports into the user's wSOL
  // ATA and then call syncNative to recognize them as token balance.
  const isWrappedSol = depositTokenMint.equals(NATIVE_MINT);

  if (depositAmount <= 0n) {
    throw new RangeError(
      `depositAmount must be > 0 (got ${depositAmount})`,
    );
  }
  if (cliffSeconds > 0 && cliffSeconds >= totalSeconds) {
    throw new RangeError(
      `cliffSeconds (${cliffSeconds}) must be < totalSeconds (${totalSeconds})`,
    );
  }

  const feeActive = !treasury.equals(ZERO_PUBKEY);
  const feeAmount = feeActive ? computeBrokerFee(depositAmount) : 0n;
  const netDepositAmount = depositAmount - feeAmount;

  if (netDepositAmount <= 0n) {
    throw new RangeError(
      `Net deposit after fee must be > 0 (deposit=${depositAmount}, fee=${feeAmount})`,
    );
  }

  // PDA bundle — single source of truth for the create-ix accounts.
  const pdas = deriveStreamPdas({
    creator: signer,
    sender: signer,
    recipient,
    salt,
    depositTokenMint,
    depositTokenProgram: TOKEN_PROGRAM_ID,
    nftTokenProgram: TOKEN_PROGRAM_ID,
  });

  const instructions: TransactionInstruction[] = [];

  // Solana defaults to 200k CUs per ix; the create instruction touches a lot
  // of accounts (Metaplex master edition + collection + token program), so
  // we proactively bump. This is cheap insurance.
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
  );
  // Pay a per-CU priority fee so leaders actually include the tx during
  // contention — without this, mainnet routinely drops our tx until the
  // blockhash expires.
  instructions.push(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
    }),
  );

  // Idempotently ensure the user's deposit-token ATA exists before the
  // create ix tries to read from it. No-op if it already exists, so we
  // can include it unconditionally without an RPC pre-flight.
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      signer,
      pdas.creatorAta,
      signer,
      depositTokenMint,
    ),
  );

  // For native-SOL locks we wrap the user's SOL into wSOL: system-transfer
  // depositAmount lamports into the wSOL ATA, then syncNative tells the
  // SPL token program to update the ATA's token balance. The result is
  // depositAmount wSOL sitting in the creator ATA, ready for the Sablier
  // create ix to spend exactly like any other SPL token.
  if (isWrappedSol) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: signer,
        toPubkey: pdas.creatorAta,
        lamports: depositAmount,
      }),
    );
    instructions.push(createSyncNativeInstruction(pdas.creatorAta));
  }

  // 1. Pre-transfer the broker fee out of the user's deposit-token ATA to
  //    the treasury ATA. Skip entirely if no treasury is configured.
  if (feeActive && feeAmount > 0n) {
    const [treasuryAta] = deriveAta(treasury, depositTokenMint);
    // Same idempotent dance for the treasury — first-ever lock per token
    // creates the treasury ATA without needing manual setup.
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        signer,
        treasuryAta,
        treasury,
        depositTokenMint,
      ),
    );
    instructions.push(
      createTransferInstruction(
        pdas.creatorAta,
        treasuryAta,
        signer,
        feeAmount,
      ),
    );
  }

  // 2. Sablier create_with_durations_ll. Use the typed Anchor builder so
  //    accounts get resolved + serialized correctly. RipGuard's defaults:
  //    is_cancelable=false (locked-self model), no front-loaded unlocks.
  const program = getLockupProgram(provider);
  const createIx = await program.methods
    .createWithDurationsLl(
      new BN(salt.toString()),
      new BN(netDepositAmount.toString()),
      new BN(cliffSeconds),
      new BN(totalSeconds),
      new BN(0), // start_unlock_amount
      new BN(0), // cliff_unlock_amount
      false, // is_cancelable — RipGuard streams are non-cancelable
    )
    .accountsPartial({
      creator: signer,
      sender: signer,
      recipient,
      depositTokenMint,
      depositTokenProgram: TOKEN_PROGRAM_ID,
      nftTokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  instructions.push(createIx);

  return {
    instructions,
    netDepositAmount,
    feeAmount,
    pdas,
    feeActive,
  };
}
