/**
 * Lifetime treasury earnings — classifies USDC transfers by source so we can
 * distinguish actual broker-fee revenue (from `createWithDurationsLL`) from
 * sweeps and any other movement.
 *
 *   pnpm earnings              → uses the default treasury (per chains.ts)
 *   pnpm earnings 0xAddr...    → any address
 *
 * Why not eth_getLogs across public RPCs? We tried. Two failure modes
 * dominate: aggressive rate-limiting (429s during the 800-chunk Polygon
 * walk) and silent-topics-filter bypass on certain public RPCs (mainnet.
 * optimism.io, arb1.arbitrum.io) which return *every* USDC Transfer and
 * inflate totals to absurd values. Per-chain explorer APIs solve both:
 * one HTTP call per chain, server-side filtering on the address, plus a
 * `method` field that lets us split broker fees from sweeps.
 *
 * Coverage:
 *   - Blockscout: Ethereum, Base, Arbitrum, Polygon  (gives method name)
 *   - Routescan : Optimism, Avalanche                (no method, raw txs)
 *   - BNB       : neither hosts a free instance — skipped with a note.
 *                 Falls back to an RPC nonce check; if treasury has never
 *                 sent a tx there, we can confidently report 0.
 */

import { formatUnits, getAddress, isAddress, type Address } from "viem";
import { CHAINS, type ChainConfig } from "../src/config/chains";

type Classified = {
  chain: ChainConfig;
  brokerFeeAmount: bigint;
  brokerFeeCount: number;
  otherInboundAmount: bigint;
  otherInboundCount: number;
  outboundAmount: bigint;
  outboundCount: number;
  source: "blockscout" | "routescan" | "rpc-nonce" | "unsupported";
  error: string | null;
};

// chainId → blockscout subdomain. Subdomains that don't host a public
// instance (Optimism, Avalanche, BNB) are intentionally absent.
const BLOCKSCOUT_SUB: Record<number, string> = {
  1: "eth",
  8453: "base",
  42161: "arbitrum",
  137: "polygon",
};

// Routescan supports a subset of EVM chains via a unified Etherscan-shaped
// API. Used as a fallback when Blockscout is missing.
const ROUTESCAN_CHAINS = new Set<number>([10, 43114]);

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  cyan: useColor ? "\x1b[36m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  green: useColor ? "\x1b[32m" : "",
  red: useColor ? "\x1b[31m" : "",
  bold: useColor ? "\x1b[1m" : "",
  dim: useColor ? "\x1b[2m" : "",
  reset: useColor ? "\x1b[0m" : "",
};

type BlockscoutTransfer = {
  method: string | null;
  from: { hash: string };
  to: { hash: string };
  token: { address_hash: string };
  total: { value: string };
};

type BlockscoutResponse = {
  items?: BlockscoutTransfer[];
  next_page_params?: Record<string, string | number | null> | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

function paramsToQuery(p: Record<string, string | number | null>): string {
  return Object.entries(p)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function viaBlockscout(chain: ChainConfig, treasury: Address): Promise<Classified> {
  const sub = BLOCKSCOUT_SUB[chain.chainId];
  const base = `https://${sub}.blockscout.com/api/v2/addresses/${treasury}/token-transfers?type=ERC-20`;
  const result: Classified = {
    chain,
    brokerFeeAmount: BigInt(0),
    brokerFeeCount: 0,
    otherInboundAmount: BigInt(0),
    otherInboundCount: 0,
    outboundAmount: BigInt(0),
    outboundCount: 0,
    source: "blockscout",
    error: null,
  };

  let url: string | null = base;
  const usdcLower = chain.usdc.toLowerCase();
  const treasuryLower = treasury.toLowerCase();

  // Hard cap on pagination so a misbehaving instance can't wedge the run.
  for (let page = 0; url && page < 50; page++) {
    let resp: BlockscoutResponse;
    try {
      resp = await fetchJson<BlockscoutResponse>(url);
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      return result;
    }
    for (const item of resp.items ?? []) {
      if (item.token.address_hash.toLowerCase() !== usdcLower) continue;
      const value = BigInt(item.total.value);
      const fromHit = item.from.hash.toLowerCase() === treasuryLower;
      const toHit = item.to.hash.toLowerCase() === treasuryLower;
      if (toHit) {
        // Sablier's createWithDurationsLL is the only legitimate broker-fee
        // path on EVM. Anything else inbound (transfers, redeemDelegations,
        // bridge mints) is bucketed as "other" so it doesn't inflate the
        // revenue figure we report.
        if (item.method === "createWithDurationsLL") {
          result.brokerFeeAmount += value;
          result.brokerFeeCount += 1;
        } else {
          result.otherInboundAmount += value;
          result.otherInboundCount += 1;
        }
      }
      if (fromHit) {
        result.outboundAmount += value;
        result.outboundCount += 1;
      }
    }
    const next = resp.next_page_params;
    url = next ? `${base}&${paramsToQuery(next)}` : null;
  }
  return result;
}

type RoutescanTokenTx = {
  contractAddress: string;
  from: string;
  to: string;
  value: string;
};

async function viaRoutescan(chain: ChainConfig, treasury: Address): Promise<Classified> {
  // Routescan returns raw transfers without method names, so we can't
  // distinguish broker fees from anything else. We bucket all inbound
  // as "other" so the user sees the data without claiming it's revenue.
  const url =
    `https://api.routescan.io/v2/network/mainnet/evm/${chain.chainId}/etherscan/api` +
    `?module=account&action=tokentx&contractaddress=${chain.usdc}` +
    `&address=${treasury}&startblock=0&endblock=99999999&sort=asc`;
  const result: Classified = {
    chain,
    brokerFeeAmount: BigInt(0),
    brokerFeeCount: 0,
    otherInboundAmount: BigInt(0),
    otherInboundCount: 0,
    outboundAmount: BigInt(0),
    outboundCount: 0,
    source: "routescan",
    error: null,
  };
  try {
    const resp = (await fetchJson(url)) as { status: string; result: RoutescanTokenTx[] | string };
    if (resp.status !== "1") {
      // Routescan returns status=0 + an empty list when the address has no
      // transfers — that's not an error, just zero activity.
      if (Array.isArray(resp.result) && resp.result.length === 0) return result;
      if (typeof resp.result === "string" && resp.result.includes("No transactions")) {
        return result;
      }
      result.error = typeof resp.result === "string" ? resp.result : "non-OK status";
      return result;
    }
    // Narrow: above this point status === "1", which by Routescan's
    // contract means result is the tx array, never the error string.
    // TS doesn't infer that from the status discriminator alone.
    if (!Array.isArray(resp.result)) return result;
    const treasuryLower = treasury.toLowerCase();
    for (const tx of resp.result) {
      const value = BigInt(tx.value);
      if (tx.to.toLowerCase() === treasuryLower) {
        result.otherInboundAmount += value;
        result.otherInboundCount += 1;
      }
      if (tx.from.toLowerCase() === treasuryLower) {
        result.outboundAmount += value;
        result.outboundCount += 1;
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

async function viaRpcNonce(chain: ChainConfig, treasury: Address): Promise<Classified> {
  // Last resort for chains we can't query via explorer APIs (BNB). If the
  // treasury has nonce 0 it has *never* sent a tx, so it can't have any
  // outbound. Inbound revenue is theoretically possible (someone could
  // transfer USDC to it) but on chains where we've never deployed it's
  // safe to call this 0. We surface the source so the caller knows.
  const result: Classified = {
    chain,
    brokerFeeAmount: BigInt(0),
    brokerFeeCount: 0,
    otherInboundAmount: BigInt(0),
    otherInboundCount: 0,
    outboundAmount: BigInt(0),
    outboundCount: 0,
    source: "rpc-nonce",
    error: null,
  };
  const rpcs: Record<number, string> = {
    56: "https://bsc-rpc.publicnode.com",
  };
  const url = rpcs[chain.chainId];
  if (!url) {
    result.source = "unsupported";
    result.error = "no explorer API and no RPC configured";
    return result;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionCount",
        params: [treasury, "latest"],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { result?: string };
    if (json.result && BigInt(json.result) > BigInt(0)) {
      result.error = `treasury has activity (nonce=${BigInt(json.result)}) but no explorer API to read it`;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

function classifyChain(chain: ChainConfig, treasury: Address): Promise<Classified> {
  if (BLOCKSCOUT_SUB[chain.chainId]) return viaBlockscout(chain, treasury);
  if (ROUTESCAN_CHAINS.has(chain.chainId)) return viaRoutescan(chain, treasury);
  return viaRpcNonce(chain, treasury);
}

function resolveTarget(): Address {
  const arg = process.argv[2];
  if (!arg) {
    const defaultChain = Object.values(CHAINS).find((c) => !c.isTestnet);
    if (!defaultChain) {
      console.error("No mainnet chain in registry.");
      process.exit(1);
    }
    return defaultChain.treasury;
  }
  if (!isAddress(arg)) {
    console.error(`"${arg}" isn't a valid EVM address.`);
    process.exit(1);
  }
  return getAddress(arg);
}

function fmtUsdc(amount: bigint, decimals: number): string {
  const display = Number(formatUnits(amount, decimals));
  return display.toFixed(decimals === 18 ? 4 : 6);
}

async function main() {
  const target = resolveTarget();
  const mainnetChains = Object.values(CHAINS).filter((c) => !c.isTestnet);

  console.log(`\n  ${c.dim}Address${c.reset}  ${target}\n`);

  const results = await Promise.all(mainnetChains.map((chain) => classifyChain(chain, target)));

  console.log(
    `  ${c.bold}${"Chain".padEnd(12)} ${"Broker fees".padStart(20)} ${"Other in".padStart(16)} ${"Outbound".padStart(16)} ${"Source".padStart(12)}${c.reset}`
  );

  let totalBrokerUsd = 0;
  let totalBrokerCount = 0;
  let totalOtherIn = 0;
  let totalOut = 0;

  for (const r of results) {
    const decimals = r.chain.usdcDecimals;
    const broker = Number(formatUnits(r.brokerFeeAmount, decimals));
    const otherIn = Number(formatUnits(r.otherInboundAmount, decimals));
    const out = Number(formatUnits(r.outboundAmount, decimals));
    totalBrokerUsd += broker;
    totalBrokerCount += r.brokerFeeCount;
    totalOtherIn += otherIn;
    totalOut += out;

    const brokerCol = broker > 0 ? c.green + c.bold : c.dim;
    const outCol = out > 0 ? c.yellow : c.dim;
    const otherCol = otherIn > 0 ? c.cyan : c.dim;
    const note = r.error ? ` ${c.red}(${r.error.slice(0, 60)})${c.reset}` : "";
    const brokerDisp = `${fmtUsdc(r.brokerFeeAmount, decimals)} (${r.brokerFeeCount})`;
    const otherDisp = `${fmtUsdc(r.otherInboundAmount, decimals)} (${r.otherInboundCount})`;
    const outDisp = `${fmtUsdc(r.outboundAmount, decimals)} (${r.outboundCount})`;
    console.log(
      `  ${r.chain.shortName.padEnd(12)} ${brokerCol}${brokerDisp.padStart(20)}${c.reset} ${otherCol}${otherDisp.padStart(16)}${c.reset} ${outCol}${outDisp.padStart(16)}${c.reset} ${c.dim}${r.source.padStart(12)}${c.reset}${note}`
    );
  }

  console.log(`  ${c.dim}${"─".repeat(82)}${c.reset}`);
  console.log(
    `  ${c.bold}${"Total".padEnd(12)} ${c.green}${totalBrokerUsd.toFixed(6).padStart(14)} USDC${c.reset} ${c.dim}(${totalBrokerCount} fee events)${c.reset}\n`
  );
  console.log(
    `  ${c.dim}Broker fees = lifetime revenue (createWithDurationsLL inbound).${c.reset}`
  );
  console.log(
    `  ${c.dim}Other in    = inbound that isn't a broker fee (refunds, manual deposits, etc.).${c.reset}`
  );
  console.log(
    `  ${c.dim}Outbound    = sweeps + any other spend.${c.reset}\n`
  );
  if (totalOtherIn > 0) {
    console.log(
      `  ${c.yellow}Note:${c.reset} ${totalOtherIn.toFixed(6)} USDC of inbound was not a broker fee. Investigate if unexpected.\n`
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
