/**
 * Build the withdraw_max instruction for claiming everything currently
 * accrued from a stream.
 *
 * The instruction needs the chainlink program + SOL/USD feed accounts
 * stored in the SolSab Treasury PDA — the program uses them to price its
 * withdrawal fee in SOL. We fetch the Treasury once per claim so we always
 * use the on-chain truth, even if Sablier rotates the feeds.
 */
import { type AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  type PublicKey,
  type TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
  createCloseAccountInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import idlJson from "@/idl/sablier_lockup.json";
import type { Idl } from "@coral-xyz/anchor";
import { PRIORITY_FEE_MICRO_LAMPORTS } from "@/config/solsab";

const SABLIER_LOCKUP_IDL = idlJson as unknown as Idl;

export interface BuildWithdrawMaxArgs {
  provider: AnchorProvider;
  signer: PublicKey;
  /** Stream NFT mint = stream identity. */
  streamNftMint: PublicKey;
  /** USDC mint at lock time (read off the StreamData). */
  depositedTokenMint: PublicKey;
}

export interface BuildWithdrawMaxResult {
  instructions: TransactionInstruction[];
}

interface TreasuryAccount {
  bump: number;
  feeCollector: PublicKey;
  chainlinkProgram: PublicKey;
  chainlinkSolUsdFeed: PublicKey;
}

export async function buildWithdrawMaxTx(
  args: BuildWithdrawMaxArgs,
): Promise<BuildWithdrawMaxResult> {
  const { provider, signer, streamNftMint, depositedTokenMint } = args;
  const program = new Program(SABLIER_LOCKUP_IDL, provider);

  // Pull chainlink wiring from the Treasury PDA. Sablier may rotate these
  // on mainnet upgrades — fetching live keeps us current without a redeploy.
  const { deriveTreasury } = await import("./pdas");
  const [treasuryPda] = deriveTreasury();
  const accountNs = program.account as unknown as {
    treasury: { fetch(addr: PublicKey): Promise<TreasuryAccount> };
  };
  const treasury = await accountNs.treasury.fetch(treasuryPda);

  const instructions: TransactionInstruction[] = [
    // Withdraw touches the same Metaplex / Sablier account web as create —
    // bump CU just like we do on the create path.
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
    // Pay a per-CU priority fee so leaders actually include the tx during
    // contention — without this, mainnet routinely drops our tx until the
    // blockhash expires.
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
    }),
  ];

  // SOL streams pay out in wrapped SOL: withdrawMax deposits the claimed
  // tokens into the recipient's wSOL ATA, leaving the user holding wSOL
  // they then have to unwrap themselves — a step many wallets hide or get
  // wrong. We make the claim self-unwrapping: ensure the wSOL ATA exists
  // before the withdraw (a prior auto-unwrap may have closed it, and the
  // program won't create it for us), then close it right after so every
  // claimed lamport — plus the ATA rent — lands as native SOL in one tx.
  const isWrappedSol = depositedTokenMint.equals(NATIVE_MINT);
  const recipientWsolAta = isWrappedSol
    ? getAssociatedTokenAddressSync(NATIVE_MINT, signer)
    : null;

  if (recipientWsolAta) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        signer,
        recipientWsolAta,
        signer,
        NATIVE_MINT,
      ),
    );
  }

  const ix = await program.methods
    .withdrawMax()
    .accountsPartial({
      signer,
      streamRecipient: signer,
      withdrawalRecipient: signer,
      depositedTokenMint,
      streamNftMint,
      depositedTokenProgram: TOKEN_PROGRAM_ID,
      nftTokenProgram: TOKEN_PROGRAM_ID,
      chainlinkProgram: treasury.chainlinkProgram,
      chainlinkSolUsdFeed: treasury.chainlinkSolUsdFeed,
    })
    .instruction();
  instructions.push(ix);

  // Closing the wSOL ATA unwraps everything in it back to native SOL.
  if (recipientWsolAta) {
    instructions.push(
      createCloseAccountInstruction(recipientWsolAta, signer, signer),
    );
  }

  return { instructions };
}
