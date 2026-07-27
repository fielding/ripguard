# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Vercel deploys and the pnpm workspace root

Each app is a separate Vercel project with `rootDirectory` set to its package
(`packages/app` -> ripguard.xyz, `packages/app-sol` -> sol.ripguard.xyz), no custom
install command, and "include source files outside the root directory" on. Vercel
therefore runs `pnpm install` *inside* the package directory.

pnpm picks the **nearest** `pnpm-workspace.yaml` walking up from the cwd. A
`pnpm-workspace.yaml` inside `packages/<app>/` makes that package its own workspace
root, so the repo-root `pnpm-lock.yaml` is ignored and every dependency is re-resolved
from its semver range at deploy time. Production then drifts away from CI and from
local, and an unrelated upstream release can break the build weeks after the last
green deploy. Keep pnpm settings (`ignoredBuiltDependencies`, overrides) in the
root `pnpm-workspace.yaml` / root `package.json` only.

`packages/app-sol/pnpm-workspace.yaml` still exists and carries this risk.

Verify a deploy the way Vercel does, not the way CI does:
`cd packages/<app> && CI=1 pnpm install && ./node_modules/.bin/next build`.
A green `pnpm install --frozen-lockfile` at the repo root does not exercise this path.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
