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
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idlJson from "@/idl/sablier_lockup.json";
import type { Idl } from "@coral-xyz/anchor";

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
  ];

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

  return { instructions };
}
