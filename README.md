# RipGuard

Self-custodial profit locking on Base. Lock USDC into time-locked vaults so you can't panic-sell your gains.

> **Built on [Sablier v2.0](https://docs.sablier.com) audited contracts. Non-custodial. Immutable locks.**

## What is this

You hit a 10x. You know you should take profit. You also know you'll "let it ride" and give it all back.

RipGuard locks your USDC into [Sablier](https://sablier.com) Lockup streams on Base. Non-cancelable, non-custodial, immutable. Your future self can't touch it until the schedule says so.

No admin keys. No upgradeability. No fund custody. Just Sablier's battle-tested lockup protocol with a UI that makes it easy.

## How it works

1. **Deposit** — Pick an amount of USDC and a lock schedule
2. **Lock** — Approve USDC, then create a Sablier Lockup stream (non-cancelable)
3. **Claim** — When the schedule unlocks, withdraw directly from Sablier

### Presets

| Preset | What it does |
|--------|-------------|
| Panic Lock 7D | Lump-sum cliff — locked for 7 days, then fully available |
| Lock 30D | Linear vest over 30 days — drip unlocks daily |
| Cliff 7D + Vest 90D | 7-day cliff, then linear unlock over 90 days |

Or set a custom schedule.

## Fees

0.5% broker fee on each lock, passed through Sablier's native broker mechanism — no separate contract involved. Fees are routed to the RipGuard Audit Fund.

## Architecture

RipGuard calls Sablier Lockup v2.0 directly — there is no custom router or wrapper contract. The frontend constructs the Sablier `createWithTimestamps` call with the user's parameters and the broker fee, then submits it on-chain.

**On-chain contracts (Base Mainnet):**

- **Sablier Lockup**: [`0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B`](https://basescan.org/address/0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B) (Sablier Lockup v2.0)
- **USDC**: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

All streams are created as **non-cancelable, non-transferable** Lockup Linear streams with both sender and recipient set to the depositor.

## Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS 4
- **Web3**: wagmi, viem, RainbowKit
- **Protocol**: Sablier Lockup v2.0 on Base
- **Token**: USDC on Base

## Development

```bash
# Install dependencies
pnpm install

# Copy environment config
cp packages/app/.env.example packages/app/.env.local

# Run the frontend
pnpm --filter app dev
```

See [`packages/app/.env.example`](packages/app/.env.example) for required environment variables.

## Security

RipGuard never custodies funds. All locks are created and enforced entirely by [Sablier's audited Lockup protocol](https://docs.sablier.com/contracts/v2/security) — there are no custom smart contracts in the system. The frontend is a thin client that constructs Sablier calls.

If you find a vulnerability, please report it responsibly by emailing the team rather than opening a public issue.

## Links

- [ripguard.xyz](https://ripguard.xyz)
- [Sablier Lockup docs](https://docs.sablier.com)
- [Base](https://base.org)

## License

MIT
