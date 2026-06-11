#!/usr/bin/env bash
# Targeted retrieval over the learnings ledger — "look up, don't load".
#
# Usage:
#   pnpm learnings                 # INDEX: every entry header (scan topics, no bodies)
#   pnpm learnings <file-or-keyword>   # print the FULL block of each entry matching the query
#                                      # (case-insensitive substring over header + body)
#
# Why this exists: docs/LEARNINGS.md is the project's long-term memory, but a fresh agent (any
# model/tool) should pull only the entries relevant to the files/topic it is about to touch — not
# read 350+ lines every session. This is retrieval via grep/awk over markdown, deliberately NOT a
# vector DB: at this scale plain-text search is instant, has zero dependencies, and stays
# tool-neutral (the gate is plain shell+git). It turns the old "grep docs/LEARNINGS.md" instruction
# into one ergonomic command. The retrieval contract is pinned by tests/harness/learnings.test.ts.
set -euo pipefail
cd "$(dirname "$0")/.."

LEDGER="docs/LEARNINGS.md"
query="${*:-}"

if [ -z "$query" ]; then
  # INDEX mode — only the dated entry headers (no bodies), so topics scan fast.
  echo "🧠 LEARNINGS INDEX — $LEDGER"
  echo "Look up an entry with: pnpm learnings <file-or-keyword>"
  echo "────────────────────────────────────────────────────────"
  grep -E '^## [0-9]{4}-' "$LEDGER" | sed -E 's/^## /  • /'
  exit 0
fi

# SEARCH mode — print each dated entry block whose text contains the query (case-insensitive).
# A "block" runs from one `## YYYY-...` header up to the line before the next. Preamble sections
# (Entry format / Promotion rule) precede the first dated header and are intentionally excluded.
status=0
awk -v q="$(printf '%s' "$query" | tr '[:upper:]' '[:lower:]')" '
  function flush() {
    if (block != "" && index(tolower(block), q) > 0) { printf "%s", block; hits++ }
  }
  /^## [0-9]{4}-/ { flush(); block = $0 ORS; next }
  { if (block != "") block = block $0 ORS }
  END { flush(); if (hits == 0) exit 9 }
' "$LEDGER" || status=$?

if [ "$status" -eq 9 ]; then
  echo "No matching learnings for: $query"
  echo "(Not an error — it means no prior agent logged a mistake on this. Browse all: pnpm learnings)"
  exit 0
fi
exit "$status"
