/** Check if a wagmi/viem error is a user wallet rejection */
export function isUserRejection(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request")
  );
}

/** Extract a human-readable reason from a wagmi/viem contract error.
 *  Falls back to a generic message if nothing useful is found. */
export function extractErrorReason(error: Error | null): string {
  if (!error) return "Transaction failed.";
  const msg = error.message ?? "";

  // Wallet is on a chain we don't support / mismatch between requested
  // chain and active chain. Surfaces as "ChainMismatchError" or the
  // less-specific "does not match the target chain" string.
  if (
    msg.includes("ChainMismatchError") ||
    msg.includes("does not match the target chain") ||
    msg.includes("chain mismatch") ||
    msg.includes("ChainNotConfiguredError") ||
    msg.includes("UnknownRpcError") && msg.toLowerCase().includes("chain")
  ) {
    return "Your wallet is on a different network than this page. Switch networks in your wallet (or use the network switcher in the header).";
  }

  // Viem contract revert reasons: "reverted with reason string 'Foo'"
  const revertMatch = msg.match(
    /reverted with reason string ['"]([^'"]+)['"]/
  );
  if (revertMatch) return revertMatch[1];

  // Viem custom error: "reverted with custom error 'ErrorName(...)'"
  const customMatch = msg.match(
    /reverted with custom error ['"]([^'"(]+)/
  );
  if (customMatch) return `Contract error: ${customMatch[1]}`;

  // Solidity panic codes
  if (msg.includes("reverted with panic code"))
    return "Contract panic (arithmetic error).";

  // Gas estimation failures
  if (
    msg.includes("gas required exceeds") ||
    msg.includes("out of gas") ||
    msg.includes("intrinsic gas too low")
  )
    return "Transaction would fail on-chain (out of gas or revert).";

  // Insufficient funds for gas
  if (msg.includes("insufficient funds"))
    return "Insufficient ETH for gas fees.";

  // ERC-20 common reverts embedded in message
  if (msg.includes("ERC20: transfer amount exceeds balance"))
    return "Insufficient USDC balance.";
  if (msg.includes("ERC20: insufficient allowance"))
    return "USDC approval insufficient.";

  // Generic fallback — keep first sentence so we don't dump a stack
  // trace into a toast.
  const trimmed = msg.split(/\.\s|\n/)[0].slice(0, 140).trim();
  if (trimmed && trimmed.length > 8 && !trimmed.includes("0x")) {
    return `${trimmed}.`;
  }
  return "Transaction failed. Please try again.";
}
