# RipGuard

Self-custodial profit locking on Base. Lock USDC into time-locked vaults so you can't panic-sell your gains.

> Unaudited beta. Not an investment product. Use at your own risk.

## What is this

You hit a 10x. You know you should take profit. You also know you'll "let it ride" and give it all back.

RipGuard locks your USDC into [Sablier](https://sablier.com) Lockup streams on Base. Non-cancelable, non-custodial, immutable. Your future self can't touch it until the schedule says so.

No custom contracts. No custody. No admin keys. Just Sablier's battle-tested lockup protocol with a UI that makes it easy.

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

0.5% broker fee on each lock, routed to the RipGuard Audit Fund. The fee is passed through Sablier's native broker mechanism — no separate contract.

## Architecture

RipGuard has zero custom smart contracts. The frontend calls Sablier's `SablierLockup` directly:

- **Lockup contract**: [`0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B`](https://basescan.org/address/0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B) (Sablier Lockup v2.0, Base)
- **USDC**: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) (Base)

All streams are created as **non-cancelable** Lockup Linear streams with the sender set to the depositor.

## Stack

- **Frontend**: Next.js, React 19, TailwindCSS 4
- **Web3**: wagmi, viem, RainbowKit
- **Protocol**: Sablier Lockup v2.0 on Base
- **Token**: USDC on Base
- **Monorepo**: pnpm workspaces (`packages/app`, `packages/contracts`)

## Development

```bash
pnpm install
pnpm --filter app dev
```

Requires a `NEXT_PUBLIC_TREASURY_ADDRESS` env var for the broker fee recipient. Without it, the broker fee is disabled (zero address).

## Links

- [ripguard.xyz](https://ripguard.xyz)
- [Sablier Lockup docs](https://docs.sablier.com)
- [Base](https://base.org)

## License

MIT
