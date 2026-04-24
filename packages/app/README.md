# RipGuard app

This package is the Next.js frontend for [RipGuard](../../README.md): the "cash this out, don't let me play" Sablier lock UI.

The app runs the public `ripguard.xyz` interface and the Base Sepolia testnet deployment. It creates non-cancelable Sablier Lockup streams directly from the browser; RipGuard does not deploy custom custody contracts.

## Local development

Use Node 22 (see the repo-level `.node-version`). Node 24 has caused SSR hydration issues in this app.

From the repository root:

```bash
pnpm install
cp packages/app/.env.example packages/app/.env.local
pnpm --filter app dev
```

Then open <http://localhost:3000>.

## Environment

`packages/app/.env.local` controls the deployed chain and wallet configuration:

- `NEXT_PUBLIC_CHAIN` — `base` for mainnet or `base-sepolia` for testnet.
- `NEXT_PUBLIC_SABLIER_LOCKUP` — optional Sablier Lockup contract override.
- `NEXT_PUBLIC_USDC_ADDRESS` — optional USDC/TestUSDC address override.
- `NEXT_PUBLIC_TREASURY_ADDRESS` — Sablier broker-fee recipient; use the zero address to disable fees in local/testnet flows.
- `NEXT_PUBLIC_WC_PROJECT_ID` — WalletConnect project ID for RainbowKit.

## Useful commands

Run these from the repository root:

```bash
pnpm --filter app test
pnpm --filter app exec tsc --noEmit
pnpm --filter app build
```

## Main surfaces

- Landing and lock creation live under `app/`.
- Wallet, chain, and Sablier transaction plumbing is in `lib/` and related hooks/components.
- The app uses wagmi, viem, RainbowKit, Tailwind 4, and Next.js 16.

For product context, contracts, fee policy, and security notes, see the repo-level [README](../../README.md).
