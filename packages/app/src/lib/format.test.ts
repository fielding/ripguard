import { describe, it, expect } from "vitest";
import { formatTokenAmount } from "./format";

const USDC = 6;
const BNB_USDC = 18;

describe("formatTokenAmount", () => {
  it("renders zero as 0", () => {
    expect(formatTokenAmount(BigInt(0), USDC)).toBe("0");
  });

  it("trims streamed USDC precision to 2 decimals", () => {
    expect(formatTokenAmount(BigInt(33_333_333), USDC)).toBe("33.33");
  });

  it("drops trailing zeros on round amounts", () => {
    expect(formatTokenAmount(BigInt(1_000_000), USDC)).toBe("1");
    expect(formatTokenAmount(BigInt(1_500_000), USDC)).toBe("1.5");
  });

  it("adds thousands separators", () => {
    expect(formatTokenAmount(BigInt(25_000_000_000), USDC)).toBe("25,000");
    expect(formatTokenAmount(BigInt(1_234_567_890_000), USDC)).toBe(
      "1,234,567.89"
    );
  });

  it("handles 18-decimal BNB-chain USDC", () => {
    expect(formatTokenAmount(BigInt(5) * BigInt(10) ** BigInt(18), BNB_USDC)).toBe("5");
    expect(formatTokenAmount(BigInt("1234567890123456789"), BNB_USDC)).toBe(
      "1.23"
    );
  });

  it("never renders a real sub-cent drip as flat 0", () => {
    expect(formatTokenAmount(BigInt(4_000), USDC)).toBe("0.004");
    expect(formatTokenAmount(BigInt(12), USDC)).toBe("0.000012");
    expect(formatTokenAmount(BigInt(1), BNB_USDC)).toBe(
      "0.000000000000000001"
    );
  });

  it("rounds to two significant digits on the drip fallback", () => {
    expect(formatTokenAmount(BigInt(125), USDC)).toBe("0.00013");
  });

  it("rounds at the precision boundary", () => {
    expect(formatTokenAmount(BigInt(995_000), USDC)).toBe("1");
  });

  it("respects a custom maxFractionDigits", () => {
    expect(formatTokenAmount(BigInt(1_234_567), USDC, 4)).toBe("1.2346");
    expect(formatTokenAmount(BigInt(1_234_567), USDC, 6)).toBe("1.234567");
  });
});
