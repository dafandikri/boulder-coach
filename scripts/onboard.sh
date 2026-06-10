#!/usr/bin/env bash
# Enforced context ingestion for a fresh agent (any model/tool) or human.
# Run this as STEP 0 of every session: `pnpm onboard`.
# It surfaces the working memory so a memoryless agent starts where the last one ended.
set -euo pipefail
cd "$(dirname "$0")/.."

# `quick` skips the (slow) gate run — used by the session-start hook to surface context fast.
QUICK="${1:-}"

hr() { printf '%s\n' "────────────────────────────────────────────────────────"; }

echo "🧗 BOULDER COACH — onboarding (run before you touch anything)"
hr
echo "REQUIRED READING (in order):"
echo "  1. AGENTS.md                      — rules every agent/tool follows (the contract)"
echo "  2. docs/HANDOFF.md                — live cursor: state, next actions, gate-blind risks"
echo "  3. docs/LEARNINGS.md              — grep it for any file you will edit"
echo "  4. docs/BACKLOG.md                — prioritized PBIs: pick the topmost unblocked item"
echo "  5. docs/plans/<feature>.md        — the plan for what you're building"
echo "  6. skills/README.md               — read the matching skill BEFORE the matching task"
hr

echo "📍 LIVE CURSOR — docs/HANDOFF.md"
hr
# Show the cursor from 'Current state' onward (skip the how-to preamble).
awk '/^## Current state/{p=1} p' docs/HANDOFF.md || cat docs/HANDOFF.md
hr

echo "🧠 LATEST LEARNINGS (last 3 entries — full log in docs/LEARNINGS.md)"
hr
awk '/^## [0-9]{4}-/{n++} n>=1' docs/LEARNINGS.md | awk 'BEGIN{c=0} /^## [0-9]{4}-/{c++} c>0 && c<=3' \
  | tail -n +1 | grep -E '^(## |- \*\*)' | tail -40 || true
hr

if [ "$QUICK" != "quick" ]; then
  echo "✅ GATE STATUS (the contract — must be green before commit)"
  hr
  if pnpm gate >/tmp/onboard-gate.log 2>&1; then
    echo "  gate: GREEN — safe to build on."
  else
    echo "  gate: RED — the tree is already failing. See /tmp/onboard-gate.log. Fix before new work."
  fi
  hr
fi

echo "🌿 GIT STATE"
hr
git --no-pager log --oneline -5 2>/dev/null || true
echo "uncommitted:"; git status --short 2>/dev/null || true
hr
echo "Next: update docs/HANDOFF.md as your LAST step. See AGENTS.md → 'Definition of done'."
