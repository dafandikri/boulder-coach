---
name: universal-quality-bar
description: Read FIRST, before any code, on any tool/model (Claude, DeepSeek, GPT, Gemini, Aider, by hand). How this repo forces highest-quality code through the gate regardless of who or what wrote it — and the three bug classes that are now build failures, not review notes.
---

# The universal quality bar (any provider, any model)

This repo is built by **memoryless agents on whatever tool/model is cheapest that day**. We cannot
rely on a model being careful, on it reading prose, or on a Claude-only review agent existing. So the
quality bar is **executable**: it lives in `pnpm gate` and the git hooks, which run identically for
Claude, DeepSeek, GPT, Gemini, Aider, or a human. **If the gate is green, the change is acceptable no
matter how it was written.** Your job is to make it green _honestly_ — never by loosening a check.

> Real history (see `docs/LEARNINGS.md`, 2026-06-10): a cheaper model shipped a green commit that
> still contained a logic bug, an unreachable dead branch, and a skipped safety review. Each hole is
> now closed by a gate check below. Read this so you don't re-open one.

## The three bug classes that are now BUILD FAILURES

### 1. Coverage can no longer hide on the aggregate → **per-file thresholds**

`vitest.config.ts` sets `thresholds.perFile: true`. **Every individual file** must clear its bar
(safety files 100% branch; rest of `src/domain` ≥92% branch; everything else ≥95% branch). A 100%-covered
neighbour can no longer mask a weak file — a single uncovered branch fails the gate, naming the file.

- **Therefore:** if you add a defensive branch you can't reach with a test, it is **dead code** —
  restructure so the meaningful case is reachable and tested, don't leave a `?? fallback` / `if (!x)
throw` that no input triggers. (This is exactly how `schedule.ts` went from 75%→100%: drop the
  `% length` wrap so "no session for this slot" becomes a real, tested rest day.)

### 2. Logic in gate-blind layers → **keep logic in covered code, and USE the helper**

React components in `src/app/**/page.tsx` have **no test harness** here (no RTL/jsdom). Any decision
you bury in a component is invisible to the gate — that is where the shipped `bumpGrade` bug lived
(a `−` button that _appended_ instead of decrementing).

- **Therefore:** put every non-trivial decision in `src/domain/**` or `src/app/lib/**` (both are
  coverage-measured) and TDD it. The component is a thin wiring layer that _calls_ the tested helper.
- **A tested-but-unused helper is a red flag**, not a convenience: it usually means the component
  re-implemented the same logic inline (and got it wrong). If `expandTally` exists, the component
  MUST use it — don't hand-roll a second version.

### 3. Safety review was prose-only → **executable safety invariants + a commit guard**

The injury-prevention core (`src/domain/adaptation.ts`, `src/domain/loadMetrics.ts`) is protected
two ways that need no specific tool:

- **`tests/domain/adaptation.invariants.test.ts`** fuzzes `adapt()` across the whole safety-relevant
  input grid and asserts the rule-table guarantees (volume never increases; pain forces open-hand +
  warm-up + ≥50% volume cut; progression never fires alongside a safety rule; ACWR caps; purity).
  Break a safety rule and the gate fails with the exact offending input. This is the tool-neutral
  replacement for a human/Claude reviewer.
- **`scripts/check-safety-change.sh`** (wired into `.husky/pre-commit`) fires when you touch a safety
  file: it surfaces the canonical rule table and runs the safety suites before the commit is allowed.

- **Therefore:** changing a safety rule means updating the canonical table in
  `docs/specs/2026-06-09-bouldering-coach-app-design.md` AND the invariants, in priority order
  (rules 1–5 always win over progression 6–7). Read `safety-critical-change.md` first. Run
  `pnpm test:safety` while iterating.

## The non-negotiable rule

When a check fails, **fix the root cause — never weaken the check to go green.** A red invariant or a
per-file coverage miss is the system working as designed. If (and only if) a check is genuinely wrong
for the codebase, change it deliberately in its own commit with a `docs/LEARNINGS.md` entry explaining
why — so the decision is durable, not a silent loosening.

## Recommended on every tool: a second-eye pass

The gate catches the bug classes above, but not every design or correctness issue. Before declaring
done, do a review pass — your tool's review command, a second model, or `requesting-code-review` /
`receiving-code-review` discipline by hand. Scrutinize new logic the way you'd scrutinize someone
else's PR; verify behavior, don't trust that "tests pass" means "correct" (see `verify-before-done.md`).
