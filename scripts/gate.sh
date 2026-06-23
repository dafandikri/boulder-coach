#!/usr/bin/env bash
# THE deterministic gate — single source of truth, fast-to-slow so cheap failures surface first.
set -euo pipefail

# 1/9 format — self-healing locally, strict in CI. Hand-editing docs (BACKLOG/HANDOFF/
# specs) and tripping `format:check` was the single most-recurring inner-loop gate failure
# (LEARNINGS 2026-06-09, 2026-06-13, 2026-06-23 — 3×, prose-only). Per the ledger's promotion
# rule (≥2× → automate), locally we `prettier --write` so the trip can't happen; in CI we keep
# `--check` so an unformatted commit still fails the merge gate (commits are already clean via
# the pre-commit lint-staged hook, so CI passes). `prettier --write` is deterministic +
# idempotent, so auto-fixing here never masks a real failure.
if [ -n "${CI:-}" ]; then echo "▶ 1/9 format (CI: --check)" && pnpm format:check; else echo "▶ 1/9 format (local: auto-fix)" && pnpm format; fi
echo "▶ 2/9 lint"          && pnpm lint
echo "▶ 3/9 typecheck"     && pnpm exec tsc --noEmit
echo "▶ 4/9 architecture"  && pnpm depcruise
echo "▶ 5/9 type-coverage" && pnpm type-coverage
echo "▶ 6/9 tests+cov"     && pnpm exec vitest run --coverage
echo "▶ 7/9 dead-code"     && pnpm knip
echo "▶ 8/9 build"         && pnpm build
echo "▶ 9/9 bundle-size"   && pnpm bundlesize

echo "✅ GATE PASSED"
