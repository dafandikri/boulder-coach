#!/usr/bin/env bash
# THE deterministic gate — single source of truth, fast-to-slow so cheap failures surface first.
set -euo pipefail

echo "▶ 1/8 format"        && pnpm format:check
echo "▶ 2/8 lint"          && pnpm lint
echo "▶ 3/8 typecheck"     && pnpm exec tsc --noEmit
echo "▶ 4/8 architecture"  && pnpm depcruise
echo "▶ 5/8 type-coverage" && pnpm type-coverage
echo "▶ 6/8 tests+cov"     && pnpm exec vitest run --coverage
echo "▶ 7/8 dead-code"     && pnpm knip
echo "▶ 8/8 build"         && pnpm build

echo "✅ GATE PASSED"
