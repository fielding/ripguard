# Backend migration stash exports

These patches preserve the three non-empty RipGuard stashes that existed before the 2026-07-30 backend migration. Each file is the verbatim output of `git stash show -p --binary --include-untracked` and retains blob IDs for `git apply --3way` recovery.

None applied cleanly forward or in reverse to `origin/main` at `1dd284b`, so none was treated as empty or already landed.

| Patch | Stash commit | First parent | Original message |
| --- | --- | --- | --- |
| `testnet-landing-polish-fd51ae9.patch` | `fd51ae94223aa486184b588a890a249d278f32ca` | `4c553dd1445820b2842eaad61853fe1d3791d651` | `WIP on testnet: 4c553dd visual: polish landing page fold` |
| `testnet-client-providers-2623bb8.patch` | `2623bb8d39a76a80c5b9214251c5118365f3d2ac` | `1ea67c8eccc7d5603e8a3115348eb71ee06e960b` | `On testnet: testnet: ClientProviders ssr:false fix + untracked files` |
| `exit-strategy-readme-14906e5.patch` | `14906e5646c3b45029333650e15111c2b1eb7b9f` | `83aa38e657a88356a456548c64d391ea17a2ac1e` | `WIP on feat/exit-strategy-lab: 97f1f5b Fix testnet vault visibility: use 2k block chunks on Base Sepolia` |

## Recovery

Start from the patch's first-parent commit when possible, then run:

```sh
git apply --3way path/to/export.patch
```

Review before committing. These patches predate the current multi-chain and Solana code and may need manual conflict resolution.
