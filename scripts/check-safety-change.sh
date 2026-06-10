#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Safety-change guard — tool-neutral, runs for ANY agent/model/tool or human.
#
# When a commit touches a safety file (the injury-prevention core), this:
#   1. forces the canonical rule table + procedure into view, and
#   2. runs the executable safety suites (unit + fuzzed invariants) and BLOCKS
#      the commit unless they pass.
#
# Wired into .husky/pre-commit so it fires on every commit regardless of which
# tool wrote the code. Plain bash + git + vitest — no Claude/IDE/plugin needed.
# See AGENTS.md → "Safety-critical changes" and skills/safety-critical-change.md.
#
# Usage:
#   scripts/check-safety-change.sh            # inspect STAGED changes (pre-commit)
#   scripts/check-safety-change.sh <gitrange> # inspect a range, e.g. main...HEAD
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SAFETY_FILES=("src/domain/adaptation.ts" "src/domain/loadMetrics.ts")

if [ "${1:-}" != "" ]; then
  changed=$(git diff --name-only "$1")
else
  changed=$(git diff --cached --name-only --diff-filter=ACM)
fi

touched=()
for f in "${SAFETY_FILES[@]}"; do
  if grep -qx "$f" <<<"$changed"; then touched+=("$f"); fi
done

if [ ${#touched[@]} -eq 0 ]; then
  exit 0 # no safety files in this change — nothing to enforce
fi

cat <<BANNER

🛡  SAFETY-CRITICAL CHANGE detected:
      ${touched[*]}

   These files encode the injury-prevention rules. Before committing, confirm your
   change against the CANONICAL rule table (not a paraphrase):
      docs/specs/2026-06-09-bouldering-coach-app-design.md  → "Adaptive Rules Engine"
   Procedure (any tool): skills/safety-critical-change.md
   Rules stay in priority order — safety rules 1–5 ALWAYS win over progression 6–7.

   Running the executable safety suites (unit + fuzzed invariants)…

BANNER

pnpm exec vitest run \
  tests/domain/adaptation.test.ts \
  tests/domain/adaptation.invariants.test.ts \
  tests/domain/loadMetrics.test.ts

cat <<DONE

✅ Safety suites pass. The fuzzed invariants confirm no rule-table guarantee was
   weakened. Commit proceeding.
DONE
