---
name: verify-before-done
description: Read before claiming a task is complete, fixed, or passing. Evidence before assertions — never call something done on unverified work.
---

# Verify before done

"Done" is a claim. Back it with evidence you actually produced, not what you expect to be true.

## Checklist before you say done

1. **Gate is green** — you ran `pnpm gate` and saw `✅ GATE PASSED` (exit 0). Not "should pass" — saw it.
2. **The thing actually works** — for behavior, run it: `pnpm test` for logic, `pnpm dev` /
   `pnpm e2e` for the app. Watch the real output. "Tests pass" ≠ "the feature works."
3. **It meets the goal, not just the task** — re-read what success looked like in the plan/spec and
   confirm the change delivers _that_, not merely that the steps were executed.
4. **No collateral damage** — the full suite passes, not just your new test.
5. **Committed cleanly** — one logical change, conventional message, gate-green on its own.
6. **Docs updated** if behavior/infra changed (same commit).

## Don't

- Don't report success from a partial run, a skipped step, or a remembered result.
- Don't hide a failure — if tests fail or a step was skipped, say so with the output.
- Don't claim "fixed" without reproducing the original problem and showing it's now gone.

## Verifying agent work

An agent's "all green, done" is a claim — **re-run the check yourself** (or have a different agent /
the gate verify). The gate is your independent, model-blind verifier; trust it over any report.
