import { describe, it, expect } from "vitest";
import { isUserRejection, extractErrorReason } from "./errors";

describe("isUserRejection", () => {
  it("returns false for null", () => {
    expect(isUserRejection(null)).toBe(false);
  });

  it("detects Phantom-style rejection", () => {
    expect(isUserRejection(new Error("User rejected the request."))).toBe(true);
  });

  it("detects WalletConnect-style rejection", () => {
    expect(isUserRejection(new Error("User denied transaction signature"))).toBe(true);
  });

  it("detects Solflare-style cancellation", () => {
    expect(isUserRejection(new Error("Transaction was not signed by the user"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isUserRejection(new Error("Blockhash not found"))).toBe(false);
    expect(isUserRejection(new Error("Insufficient lamports"))).toBe(false);
  });
});

describe("extractErrorReason", () => {
  it("returns generic message for null", () => {
    expect(extractErrorReason(null)).toBe("Transaction failed.");
  });

  it("translates the empty-wallet preflight error", () => {
    const err = new Error(
      "Transaction simulation failed: Attempt to debit an account but found no record of a prior credit. Logs: [].",
    );
    expect(extractErrorReason(err)).toContain("no SOL on this network");
  });

  it("translates insufficient lamports", () => {
    expect(extractErrorReason(new Error("insufficient lamports for rent")))
      .toContain("Not enough SOL");
  });

  it("translates expired blockhash", () => {
    expect(extractErrorReason(new Error("Signature has expired: block height exceeded")))
      .toContain("transaction expired");
  });

  it("translates a missing on-chain account as a cluster hint", () => {
    expect(extractErrorReason(new Error("AccountNotFound: ...")))
      .toContain("same network as this site");
  });

  it("extracts Anchor error message", () => {
    const err = new Error(
      "AnchorError caused by account: stream. Error Code: SomeError. Error Number: 6000. Error Message: The stream has already been claimed.",
    );
    expect(extractErrorReason(err)).toBe("The stream has already been claimed");
  });

  it("formats raw custom program error codes", () => {
    expect(extractErrorReason(new Error("Custom program error: 0x1771")))
      .toContain("0x1771");
  });

  it("strips Lock failed: wrapper", () => {
    const err = new Error("Lock failed: Blockhash not found");
    expect(extractErrorReason(err)).toContain("transaction expired");
  });

  it("falls back to a clean first sentence", () => {
    expect(extractErrorReason(new Error("Something weird happened. With extra detail.")))
      .toBe("Something weird happened.");
  });
});
