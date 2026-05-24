# RipGuard Solana app

This package is the Solana frontend for [RipGuard](../../README.md): the "cash this out, don't let me play" lock UI, using the SolSab/Sablier Lockup program instead of the EVM Lockup contract.

The app runs the Solana deployment (`sol.ripguard.xyz` / `testnet.sol.ripguard.xyz`). It lets users connect a Solana wallet, wrap native SOL into wSOL as part of the lock flow, and create non-cancelable Sablier Lockup streams from the browser. RipGuard does not custody funds or deploy a custom lock contract for this app.

## What this package owns

- Solana landing, create-lock, vault discovery, and withdraw UI under `src/app/`.
- Wallet setup for Phantom, Solflare, wallet-standard wallets, Solana Mobile Wallet Adapter, and MetaMask Solana support in `src/providers.tsx`.
- SolSab/Sablier Lockup transaction building in `src/sol/lock.ts` and related PDA/preset/vault helpers under `src/sol/`.
- Chain, RPC, program, token, treasury, priority-fee, explorer, and preset config in `src/config/solsab.ts`.
- Brand/metadata surfaces for the Solana deployment, including OG/Twitter image generation.

For the Base/EVM app, use `packages/app`. For project-level positioning, contracts, fee policy, and security notes, see the repo-level [README](../../README.md).

## Development

Requires Node 22 (see the repo root `.node-version`) and pnpm 10. Work from the repository root unless noted otherwise.

```bash
pnpm install
pnpm --filter app-sol dev
```

The Solana app dev server runs on port 3001. Open [http://localhost:3001](http://localhost:3001).

Useful scripts:

```bash
pnpm --filter app-sol test
pnpm --filter app-sol lint
pnpm --filter app-sol build
pnpm --filter app-sol balances
pnpm --filter app-sol smoke:lock
pnpm --filter app-sol fetch:idl
```

## Environment

Key public environment variables:

- `NEXT_PUBLIC_SOLANA_NETWORK` — `devnet` by default; accepts `mainnet` / `mainnet-beta` for production.
- `NEXT_PUBLIC_SOLANA_RPC` — optional RPC override. Use a production RPC provider for mainnet; public Solana RPC is rate-limited.
- `NEXT_PUBLIC_TREASURY_PUBKEY` — broker-fee recipient. Omit it on devnet to disable the fee via the zero-pubkey sentinel.
- `NEXT_PUBLIC_PRIORITY_FEE_MICRO_LAMPORTS` — optional priority-fee override for mainnet lock transactions.

## Chain notes

- Deposit asset: native SOL, wrapped to wSOL inside the lock transaction because SolSab streams SPL tokens.
- Program: SolSab/Sablier Lockup (`4EauRKrNErKfsR4XetEZJNmvACGHbHnHV4R5dvJuqupC`).
- Devnet is treated as the testnet deployment; Solana's validator-rotation `testnet` cluster is intentionally not used for the app.
- The fee path is a client-built transfer to the configured treasury before calling SolSab with the net lock amount; if no treasury is configured, the fee instruction is omitted.

## Verification before changing lock behavior

When touching schedule math, PDA derivation, transaction construction, or vault discovery, run the targeted tests plus the package test suite:

```bash
pnpm --filter app-sol test
```

For docs-only edits, at minimum run `git diff --check` and a marker smoke that proves this README still describes the Solana-specific package rather than generic framework boilerplate.
