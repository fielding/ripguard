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

  return "Transaction failed. Please try again.";
}
