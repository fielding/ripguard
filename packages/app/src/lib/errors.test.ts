import { describe, it, expect } from "vitest";
import { isUserRejection, extractErrorReason } from "./errors";

describe("isUserRejection", () => {
  it("returns false for null", () => {
    expect(isUserRejection(null)).toBe(false);
  });

  it("detects MetaMask-style rejection", () => {
    expect(isUserRejection(new Error("User rejected the request."))).toBe(true);
  });

  it("detects WalletConnect-style rejection", () => {
    expect(isUserRejection(new Error("User denied transaction signature"))).toBe(true);
  });

  it("detects generic rejection", () => {
    expect(isUserRejection(new Error("user rejected"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isUserRejection(new Error("out of gas"))).toBe(false);
    expect(isUserRejection(new Error("insufficient funds"))).toBe(false);
    expect(isUserRejection(new Error("network error"))).toBe(false);
  });
});

describe("extractErrorReason", () => {
  it("returns generic message for null", () => {
    expect(extractErrorReason(null)).toBe("Transaction failed.");
  });

  it("extracts Solidity revert reason", () => {
    const err = new Error("reverted with reason string 'ERC20: transfer amount exceeds balance'");
    expect(extractErrorReason(err)).toBe("ERC20: transfer amount exceeds balance");
  });

  it("extracts custom error name", () => {
    const err = new Error("reverted with custom error 'SablierLockup_ZeroAmount()'");
    expect(extractErrorReason(err)).toBe("Contract error: SablierLockup_ZeroAmount");
  });

  it("detects panic codes", () => {
    const err = new Error("reverted with panic code 0x11");
    expect(extractErrorReason(err)).toBe("Contract panic (arithmetic error).");
  });

  it("detects gas errors", () => {
    expect(extractErrorReason(new Error("gas required exceeds allowance")))
      .toBe("Transaction would fail on-chain (out of gas or revert).");
    expect(extractErrorReason(new Error("out of gas")))
      .toBe("Transaction would fail on-chain (out of gas or revert).");
    expect(extractErrorReason(new Error("intrinsic gas too low")))
      .toBe("Transaction would fail on-chain (out of gas or revert).");
  });

  it("detects insufficient funds", () => {
    expect(extractErrorReason(new Error("insufficient funds for gas * price + value")))
      .toBe("Insufficient ETH for gas fees.");
  });

  it("detects ERC-20 specific errors", () => {
    expect(extractErrorReason(new Error("ERC20: transfer amount exceeds balance")))
      .toBe("Insufficient USDC balance.");
    expect(extractErrorReason(new Error("ERC20: insufficient allowance")))
      .toBe("USDC approval insufficient.");
  });

  it("preserves a clean first sentence for unknown errors", () => {
    expect(extractErrorReason(new Error("something unexpected. with details")))
      .toBe("something unexpected.");
  });

  it("falls back to generic for hex-blob errors", () => {
    expect(extractErrorReason(new Error("0xdeadbeef internal error")))
      .toBe("Transaction failed. Please try again.");
  });

  it("translates ChainMismatchError", () => {
    expect(extractErrorReason(new Error("ChainMismatchError: chain ID does not match")))
      .toContain("different network");
  });
});
