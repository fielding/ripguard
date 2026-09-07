#!/usr/bin/env bash
# Vercel "Ignored Build Step" for one package of this monorepo.
#
# Exit 0 = skip the build, exit 1 = build. Anything uncertain builds.
# Wired from packages/<app>/vercel.json (Vercel reads vercel.json from each
# project's Root Directory, so the shared logic lives here).
#
# Every push used to build all three Vercel projects, and the two deployment
# branches each produced a Preview on the projects they are not production
# for. That tripled Functions Storage for nothing.
set -u
pkg="${1:?usage: vercel-ignore.sh packages/<app>}"
cd "$(git rev-parse --show-toplevel)" || exit 1

# 1. `main` is production for ripguard + ripguard-sol, `testnet` for
#    ripguard-testnet. A push to either also triggers a Preview build on the
#    other project(s) that nobody looks at.
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  case "${VERCEL_GIT_COMMIT_REF:-}" in
    main|testnet)
      echo "ignore: preview of deployment branch '$VERCEL_GIT_COMMIT_REF'"
      exit 0
      ;;
  esac
fi

# 2. Nothing this package depends on changed since the last successful
#    deployment of this branch. Compare against that SHA, not HEAD^: a
#    fast-forward of `testnet` lands several commits at once and HEAD^ would
#    only see the last one. Unknown base (first deploy, shallow clone too
#    short) -> build.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -n "$base" ] && git cat-file -e "${base}^{commit}" 2>/dev/null; then
  if git diff --quiet "$base" HEAD -- \
      "$pkg" \
      package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .node-version \
      scripts/vercel-ignore.sh; then
    echo "ignore: no changes under $pkg or the workspace manifests since ${base:0:7}"
    exit 0
  fi
fi

exit 1
