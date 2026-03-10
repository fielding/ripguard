# RipGuard DeFi Llama Adapter

TVL adapter for [DeFi Llama](https://defillama.com/). Tracks USDC locked in Sablier Lockup v2.0 streams created through RipGuard.

## How it works

RipGuard creates Sablier streams with `shape: "RipGuard"`. The adapter:

1. Reads `CreateLockupLinearStream` events from Sablier Lockup on Base
2. Filters for streams where `shape == "RipGuard"`
3. Multicalls `getStream()` on each to get current locked balances
4. Sums `deposited - withdrawn - refunded` as TVL

## Submission

1. Fork [DefiLlama/DefiLlama-Adapters](https://github.com/DefiLlama/DefiLlama-Adapters)
2. Copy `projects/ripguard/` into the fork
3. Test locally: `node test.js projects/ripguard`
4. Open PR with "Allow edits by maintainers" enabled
5. Do NOT ping maintainers — they monitor PRs automatically

## Protocol metadata

See the `protocol-metadata.json` file — paste into the PR description or DeFi Llama's submission form.
