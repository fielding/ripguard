/** Check if a wallet error is a user rejection */
export function isUserRejection(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request") ||
    // Phantom + Solflare specific
    msg.includes("transaction was not signed") ||
    msg.includes("approval denied")
  );
}

/** Translate a raw Solana / wallet error message into something a user
 *  can act on. The SDK errors are all stack traces and program logs —
 *  we map the common shapes to plain English. */
export function extractErrorReason(error: Error | null): string {
  if (!error) return "Transaction failed.";
  const msg = error.message ?? "";

  // ── Empty / underfunded wallet ──────────────────────────────────────
  // Surfaces from preflight when SystemProgram tries to debit a wallet
  // that has zero lamports on the cluster the dApp is connected to.
  // Most commonly: user's wallet is set to a different cluster (devnet
  // when site is mainnet, or vice versa).
  if (msg.includes("Attempt to debit an account but found no record of a prior credit")) {
    return "Your wallet has no SOL on this network. If you keep funds on a different cluster (devnet vs mainnet), switch your wallet's network and try again.";
  }
  if (
    msg.includes("insufficient lamports") ||
    msg.includes("Insufficient lamports") ||
    msg.includes("InsufficientFundsForRent")
  ) {
    return "Not enough SOL to cover the lock + rent + transaction fee. Top up the wallet a little (rent for a new account is ~0.002 SOL).";
  }

  // ── Tx-landing / blockhash issues ───────────────────────────────────
  if (
    msg.includes("Blockhash not found") ||
    msg.includes("blockhash not found") ||
    msg.includes("block height exceeded") ||
    msg.includes("BlockhashNotFound")
  ) {
    return "The transaction expired before it landed. Try again, the network is busy.";
  }
  if (msg.toLowerCase().includes("transaction was not confirmed")) {
    return "Couldn't confirm the transaction. Check your wallet history before retrying. It may have landed.";
  }

  // ── Wrong cluster heuristics ────────────────────────────────────────
  // These typically fire when accounts that should exist (the Sablier
  // program, treasury PDA, etc.) aren't found — a strong signal that
  // the wallet/RPC is pointed at the wrong cluster.
  if (
    msg.includes("AccountNotFound") ||
    msg.includes("Account does not exist") ||
    msg.includes("could not find account") ||
    msg.includes("AccountOwnedByWrongProgram")
  ) {
    return "An expected on-chain account is missing. Make sure your wallet is on the same network as this site (mainnet for sol.ripguard.xyz, devnet for testnet.sol.ripguard.xyz).";
  }

  // ── Anchor / program errors ─────────────────────────────────────────
  // "AnchorError caused by account: foo. Error Code: ... Error Number: ...
  //  Error Message: <human readable>." Match across periods (the message
  //  body itself can contain them).
  const anchorMatch = msg.match(/Error Message:\s*([^.]+)/i);
  if (anchorMatch) return anchorMatch[1].trim();
  const customMatch = msg.match(/Custom program error:\s*(0x[\da-fA-F]+)/);
  if (customMatch) {
    return `Contract rejected the transaction (error ${customMatch[1]}). Try again or check the on-chain logs.`;
  }

  // ── Strip wrapper prefixes ──────────────────────────────────────────
  // Most useful messages live after these wrappers. Recurse so the
  // inner pattern matchers above still apply.
  const stripPrefixes = [
    /^Transaction simulation failed:\s*/i,
    /^Simulation failed:\s*/i,
    /^Lock failed:\s*/i,
    /^Claim failed:\s*/i,
  ];
  for (const re of stripPrefixes) {
    if (re.test(msg)) {
      return extractErrorReason(new Error(msg.replace(re, "")));
    }
  }

  // ── Generic fallback ────────────────────────────────────────────────
  // Don't dump the full stack-trace blob. Keep first sentence (up to
  // the first period or 120 chars) and let the user retry.
  const trimmed = msg.split(/\.\s|\n/)[0].slice(0, 120).trim();
  if (trimmed && trimmed.length > 8) return `${trimmed}.`;
  return "Transaction failed. Please try again.";
}
