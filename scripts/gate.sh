#!/usr/bin/env bash
# THE deterministic gate — single source of truth, fast-to-slow so cheap failures surface first.
set -euo pipefail

echo "▶ 1/9 format"        && pnpm format:check
echo "▶ 2/9 lint"          && pnpm lint
echo "▶ 3/9 typecheck"     && pnpm exec tsc --noEmit
echo "▶ 4/9 architecture"  && pnpm depcruise
echo "▶ 5/9 type-coverage" && pnpm type-coverage
echo "▶ 6/9 tests+cov"     && pnpm exec vitest run --coverage
echo "▶ 7/9 dead-code"     && pnpm knip
echo "▶ 8/9 build"         && pnpm build
echo "▶ 9/9 bundle-size"   && pnpm bundlesize

echo "✅ GATE PASSED"
