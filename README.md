# RipGuard

The "cash this out, don't let me play" button. Lock USDC into a Sablier stream that pays you back on your own schedule, so the degen you're about to be can't undo the win you just had.

> Non-custodial. Non-cancelable. Enforced on-chain by [Sablier](https://sablier.com) v2.0 audited contracts. Not financial advice. DYOR.

**Live:** [ripguard.xyz](https://ripguard.xyz) (Base mainnet) · [testnet.ripguard.xyz](https://testnet.ripguard.xyz) (Base Sepolia)

## What is this

You hit a W. Your brain says "one more play." You know how this ends.

RipGuard drops your USDC into a non-cancelable [Sablier Lockup](https://docs.sablier.com) stream on Base. Your past self sets the unlock schedule. Your future self claims it back on the clock. The degen in the middle begs, and the on-chain answer is no.

No admin keys. No upgrade path. No RipGuard custody. We deploy zero custom contracts — the frontend calls Sablier directly. If RipGuard the site disappears tomorrow, your lock keeps counting down on-chain and you can claim it through BaseScan or the Sablier app.

## How it works

1. **Pick an amount and a reload schedule.** USDC on Base.
2. **Sign the lock.** One transaction. The USDC routes directly into Sablier's Lockup contract with the sender, recipient, and unlock schedule you chose. Non-cancelable. Non-transferable.
3. **Come back and claim.** Vaults show the live countdown and claimable amount. Claim when the schedule unlocks.

## Reloads

Six built-in presets plus custom:

| Preset | What it does |
|---|---|
| **Hourly Payouts (24h)** | Reload every hour for 24 hours |
| **Hourly Payouts (3d)** | Reload every hour for 3 days |
| **Hourly Payouts (1w)** | Reload every hour for 7 days |
| **Daily Payouts (1w)** | Reload once a day for 7 days |
| **Panic Lock (24h)** | Lock everything for 24 hours, one-shot unlock |
| **Panic Lock + Daily Payouts** | 1-day cliff, then daily reloads for 7 days |

Or build your own: pick a total window, a reload cadence, and optionally a waiting period before reloads start.

## Fees

0.5% broker fee on each lock, collected via Sablier's native broker mechanism and routed directly to the RipGuard treasury during stream creation. Shown before you sign. No withdraw fees. No subscriptions. No yield cuts. No upside share.

## Architecture

**Zero custom contracts.** The frontend calls [`SablierLockup.createWithDurationsLL()`](https://docs.sablier.com/api/reference) directly. Every lock is a non-cancelable, non-transferable Lockup Linear stream with the sender and recipient both set to the depositor.

**Contracts:**

| Chain | Contract | Address |
|---|---|---|
| Base mainnet | Sablier Lockup v2.0 | [`0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B`](https://basescan.org/address/0xb5D78DD3276325f5FAF3106Cc4Acc56E28e0Fe3B) |
| Base mainnet | USDC | [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| Base Sepolia | Sablier Lockup v2.0 | [`0xa4777ca525d43a7af55d45b11b430606d7416f8d`](https://sepolia.basescan.org/address/0xa4777ca525d43a7af55d45b11b430606d7416f8d) |
| Base Sepolia | TestUSDC (mintable) | [`0x54C0f145D70ca4792e695697B6498552F1EC0009`](https://sepolia.basescan.org/address/0x54C0f145D70ca4792e695697B6498552F1EC0009) |

The `packages/contracts/` directory holds an unused `RipGuardRouter.sol` from an earlier iteration. It is not deployed and not called by the frontend — kept around only as a reference for a potential Phase 2.

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind 4
- **Web3:** wagmi 2, viem 2, RainbowKit 2
- **Protocol:** Sablier Lockup v2.0 on Base
- **Token:** USDC on Base
- **Indexer:** Sablier Envio indexer (primary), on-chain `getLogs` fallback
- **Monorepo:** pnpm workspaces (`packages/app` EVM, `packages/app-sol` Solana, `packages/contracts` unused reference)

## Development

Requires Node 22 (see `.node-version`). Node 24 causes SSR hydration errors.

```bash
pnpm install
cp packages/app/.env.example packages/app/.env.local
pnpm --filter app dev
```

Key env vars in `packages/app/.env.local`:

- `NEXT_PUBLIC_CHAIN` — `base` (default) or `base-sepolia`
- `NEXT_PUBLIC_SABLIER_LOCKUP` — override for testnet address
- `NEXT_PUBLIC_USDC_ADDRESS` — override for testnet address
- `NEXT_PUBLIC_TREASURY_ADDRESS` — broker fee recipient. Set to zero address to disable the fee (useful on testnet).
- `NEXT_PUBLIC_WC_PROJECT_ID` — WalletConnect project ID

```bash
pnpm --filter app test        # vitest
pnpm --filter app exec tsc --noEmit
pnpm --filter app build
```

## Security

RipGuard custodies nothing. Every lock is created directly in [Sablier's audited Lockup protocol](https://docs.sablier.com/contracts/v2/security) — an immutable, non-upgradeable contract that's been multi-audited and secures hundreds of millions in vesting streams. The RipGuard frontend is a UI. We deploy no custom contracts, hold no admin keys, and have no path to pause, rug, or freeze your funds.

That said: smart contracts carry risk. Start with $5. Verify the Sablier Lockup contract yourself on BaseScan before committing real size. The presets are designed around real-session behavior, but they're opinions, not financial advice.

If you find a vulnerability in RipGuard itself, please report it by opening a GitHub issue or reaching out before public disclosure.

## Links

- [ripguard.xyz](https://ripguard.xyz) — mainnet
- [testnet.ripguard.xyz](https://testnet.ripguard.xyz) — Base Sepolia
- [Sablier docs](https://docs.sablier.com)
- [Base](https://base.org)

## License

MIT
