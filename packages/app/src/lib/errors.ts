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

// Sablier v2.0 custom error → human-readable message
const SABLIER_ERRORS: Record<string, string> = {
  SablierV2Lockup_BrokerFeeTooHigh: "Broker fee exceeds the maximum allowed.",
  SablierV2Lockup_DepositAmountZero: "Deposit amount cannot be zero.",
  SablierV2Lockup_DurationCalculationOverflow: "Duration values are too large.",
  SablierV2Lockup_InvalidStreamTimes: "Invalid stream times — cliff must be shorter than total duration.",
  SablierV2Lockup_NotTransferable: "This stream is not transferable.",
  SablierV2Lockup_StreamCanceled: "Stream has already been canceled.",
  SablierV2Lockup_StreamDepleted: "Stream has already been fully withdrawn.",
  SablierV2Lockup_StreamNotActive: "Stream is not active.",
  SablierV2Lockup_StreamSettled: "Stream has already settled.",
  SablierV2Lockup_Unauthorized: "You are not authorized to perform this action.",
  SablierV2Lockup_WithdrawAmountZero: "Withdraw amount cannot be zero.",
  SablierV2Lockup_WithdrawAmountGTWithdrawableAmount: "Withdraw amount exceeds available balance.",
  SablierV2Lockup_StartTimeNotLessThanEndTime: "Start time must be before end time.",
};

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
  if (customMatch) {
    const errName = customMatch[1];
    return SABLIER_ERRORS[errName] ?? `Contract error: ${errName}`;
  }

  // Sablier error names embedded in the message directly (some wallets surface them differently)
  for (const [errName, humanMsg] of Object.entries(SABLIER_ERRORS)) {
    if (msg.includes(errName)) return humanMsg;
  }

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
