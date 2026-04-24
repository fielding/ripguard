import { describe, it, expect } from "vitest";
import {
  CHAINS,
  DEFAULT_CHAIN_ID,
  SUPPORTED_CHAIN_IDS,
  getChainConfig,
  isSupportedChain,
} from "./chains";

describe("chain registry", () => {
  it("contains Base mainnet (8453)", () => {
    const base = getChainConfig(8453);
    expect(base.name).toBe("Base");
    expect(base.chainId).toBe(8453);
    expect(base.isTestnet).toBe(false);
    expect(base.usdcDecimals).toBe(6);
  });

  it("contains Base Sepolia (84532)", () => {
    const sepolia = getChainConfig(84532);
    expect(sepolia.chainId).toBe(84532);
    expect(sepolia.isTestnet).toBe(true);
    expect(sepolia.usdcDecimals).toBe(6);
  });

  it("throws on unsupported chainId", () => {
    expect(() => getChainConfig(1)).toThrow(/Unsupported chainId: 1/);
  });

  it("DEFAULT_CHAIN_ID resolves to a registered chain", () => {
    expect(() => getChainConfig(DEFAULT_CHAIN_ID)).not.toThrow();
  });

  it("every chain has valid addresses and positive numerics", () => {
    for (const chain of Object.values(CHAINS)) {
      expect(chain.sablierLockup, `${chain.name} sablierLockup`).toMatch(
        /^0x[a-fA-F0-9]{40}$/
      );
      expect(chain.usdc, `${chain.name} usdc`).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(chain.usdcDecimals, `${chain.name} usdcDecimals`).toBeGreaterThan(0);
      expect(chain.streamStartBlock > BigInt(0), `${chain.name} streamStartBlock`).toBe(true);
      expect(chain.logChunkSize > BigInt(0), `${chain.name} logChunkSize`).toBe(true);
      expect(chain.explorerUrl, `${chain.name} explorerUrl`).toMatch(/^https:\/\//);
    }
  });

  it("SUPPORTED_CHAIN_IDS matches CHAINS keys", () => {
    expect(SUPPORTED_CHAIN_IDS.sort()).toEqual(Object.keys(CHAINS).map(Number).sort());
  });

  it("isSupportedChain recognizes registered chains", () => {
    expect(isSupportedChain(8453)).toBe(true);
    expect(isSupportedChain(84532)).toBe(true);
    expect(isSupportedChain(1)).toBe(false);
    expect(isSupportedChain(undefined)).toBe(false);
  });
});
