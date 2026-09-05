import { describe, it, expect, vi } from "vitest";
import {
  CHAINS,
  DEFAULT_CHAIN_ID,
  DEPLOYMENT_CHAINS,
  SUPPORTED_CHAIN_IDS,
  getChainConfig,
  isSupportedChain,
  isSupportedDeploymentChain,
  parseRpcOverrides,
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
    expect(() => getChainConfig(999_999)).toThrow(/Unsupported chainId: 999999/);
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
      expect(chain.treasury, `${chain.name} treasury`).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(chain.usdcDecimals, `${chain.name} usdcDecimals`).toBeGreaterThan(0);
      expect(chain.rpcUrls.length, `${chain.name} rpcUrls`).toBeGreaterThan(0);
      for (const url of chain.rpcUrls) {
        expect(url, `${chain.name} rpcUrl`).toMatch(/^https:\/\//);
      }
      expect(chain.explorerUrl, `${chain.name} explorerUrl`).toMatch(/^https:\/\//);
    }
  });

  it("SUPPORTED_CHAIN_IDS matches CHAINS keys", () => {
    expect([...SUPPORTED_CHAIN_IDS].sort()).toEqual(
      Object.keys(CHAINS).map(Number).sort()
    );
  });

  it("isSupportedChain recognizes registered chains", () => {
    expect(isSupportedChain(8453)).toBe(true);
    expect(isSupportedChain(84532)).toBe(true);
    expect(isSupportedChain(1)).toBe(true);
    expect(isSupportedChain(999_999)).toBe(false);
    expect(isSupportedChain(undefined)).toBe(false);
  });

  it("isSupportedDeploymentChain filters by deployment's testnet flag", () => {
    // Mainnet deployment: Base mainnet ✓, Base Sepolia ✗
    expect(isSupportedDeploymentChain(8453, false)).toBe(true);
    expect(isSupportedDeploymentChain(84532, false)).toBe(false);
    // Testnet deployment: Base Sepolia ✓, Base mainnet ✗
    expect(isSupportedDeploymentChain(84532, true)).toBe(true);
    expect(isSupportedDeploymentChain(8453, true)).toBe(false);
    // Unregistered chain: false either way
    expect(isSupportedDeploymentChain(999_999, false)).toBe(false);
    expect(isSupportedDeploymentChain(999_999, true)).toBe(false);
    expect(isSupportedDeploymentChain(undefined, false)).toBe(false);
  });

  it("BNB Chain uses 18-decimal Binance-Peg USDC", () => {
    const bsc = getChainConfig(56);
    expect(bsc.usdcDecimals, "BNB Chain USDC is 18 decimals, not 6").toBe(18);
    expect(bsc.usdc).toBe("0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");
    expect(bsc.usdcNote, "BNB Chain entry must disclose Binance-Peg variant").toMatch(
      /Binance-Peg/i
    );
  });

  it("every other registered chain uses 6-decimal USDC", () => {
    for (const chain of Object.values(CHAINS)) {
      if (chain.chainId === 56) continue; // BNB is the documented exception
      expect(chain.usdcDecimals, `${chain.name} expected 6 decimals`).toBe(6);
    }
  });

  it("all mainnet chains share the same treasury EOA", () => {
    const mainnetChains = Object.values(CHAINS).filter((c) => !c.isTestnet);
    const treasuries = new Set(mainnetChains.map((c) => c.treasury.toLowerCase()));
    expect(treasuries.size, "treasury must be the same address on every mainnet chain").toBe(1);
  });

  it("all 7 target EVM mainnet chains are present", () => {
    // Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, BNB Chain
    const expected = [1, 10, 56, 137, 8453, 42161, 43114];
    for (const id of expected) {
      expect(isSupportedChain(id), `chainId ${id} must be in the registry`).toBe(true);
    }
  });
});

describe("DEPLOYMENT_CHAINS", () => {
  it("only contains chains matching the default chain's testnet flag", () => {
    const flag = getChainConfig(DEFAULT_CHAIN_ID).isTestnet;
    expect(DEPLOYMENT_CHAINS.length).toBeGreaterThan(0);
    for (const chain of DEPLOYMENT_CHAINS) {
      expect(chain.isTestnet, chain.name).toBe(flag);
    }
    expect(DEPLOYMENT_CHAINS.some((c) => c.chainId === DEFAULT_CHAIN_ID)).toBe(true);
  });
});

describe("parseRpcOverrides", () => {
  it("returns no overrides for an unset variable", () => {
    expect(parseRpcOverrides(undefined)).toEqual({});
    expect(parseRpcOverrides("")).toEqual({});
  });

  it("parses a chainId-keyed object of https URLs", () => {
    expect(
      parseRpcOverrides('{"8453":"https://base.example/v2/key","1":"https://eth.example"}'),
    ).toEqual({ 8453: "https://base.example/v2/key", 1: "https://eth.example" });
  });

  it("degrades to public defaults on malformed input instead of throwing", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(parseRpcOverrides("{not json")).toEqual({});
      expect(parseRpcOverrides('["https://a"]')).toEqual({});
      expect(parseRpcOverrides('"https://a"')).toEqual({});
      // Bad entries are dropped individually; good ones survive.
      expect(
        parseRpcOverrides('{"base":"https://a","8453":"http://insecure","1":"https://ok"}'),
      ).toEqual({ 1: "https://ok" });
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
