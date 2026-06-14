---
name: test-driven-development
description: Read before writing any logic or bugfix. Red → green → refactor, tuned to this repo. Produces correct code with the coverage the gate demands, first time.
---

# Test-driven development

Write the test first. A test written after the code tends to test what the code _does_, not what it
_should_ do.

## The loop

1. **Red** — write the failing test. Run it; confirm it fails for the **right reason** (assertion, not
   a typo or missing import). `pnpm exec vitest run <name>`.
2. **Green** — the **minimal** code to pass. Don't build beyond the test (YAGNI).
3. **Refactor** — clean up with the test as a safety net. Re-run.

## In this repo

- Tests go in `tests/**/*.test.ts`. Import the unit under test (relative or `@/…` both resolve).
- **`!` (non-null assertion) is allowed in tests** — `arr[0]!.field` — so array-indexing assertions are
  ergonomic. (It's banned in `src/`; narrow there instead.)
- **Test behavior, not implementation.** Assert outputs/observable effects, not internal calls.
- **Cover the branches the gate requires.** For safety files (`adaptation.ts`, `loadMetrics.ts`) that's
  **100% branch** — explicitly test boundaries and edge inputs (exact thresholds, zero/undefined flags,
  the "already in the target state" case). For other domain code aim ≥ 92% branch (everything else ≥ 95%).
- **Prefer integration-style domain tests** (drive a function end-to-end with realistic inputs) over
  testing trivial internals — they catch real bugs.
- Use a test/mock/dummy/example marker in fixture data.

## Hard rule

**Never weaken a test to make it pass.** If a test seems wrong, stop and question the _code_ (or the
spec) first. Deleting an assertion to get green is the classic way to ship a bug.
