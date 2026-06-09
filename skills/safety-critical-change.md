---
name: safety-critical-change
description: MANDATORY before editing src/domain/adaptation.ts or src/domain/loadMetrics.ts. These decide injury-related load management — a wrong threshold can hurt a climber.
---

# Safety-critical change

`src/domain/adaptation.ts` (the rules engine) and `src/domain/loadMetrics.ts` (ACWR math) decide what
an injured climber is told to do. Treat them differently from normal code.

## Procedure

1. **Read the canonical source first** — the rule table and ACWR formulas in
   `docs/specs/2026-06-09-bouldering-coach-app-design.md`. Implement from it; **never paraphrase from
   memory** (paraphrasing was the #1 logged failure mode).
2. **Preserve priority order** (safety first): pain → soreness → ACWR-high → ACWR-caution → fatigue →
   progress → default. Pain and ACWR-high **return early** so nothing downstream can override safety.
3. **Exact thresholds** — `> 1.5` (force deload) and `>= 1.3` (cap intensity). An off-by-one here is an
   injury risk. Add boundary tests at exactly `1.3` and `1.5`.
4. **Never increase load/volume/intensity when a safety flag is active.**
5. **100% branch coverage** — every path tested, including the edge branches (zero/undefined flag,
   already-open-hand grip, etc.).
6. **Keep it pure** — clone before mutating; no I/O; the caller passes `asOf` (no internal `Date.now()`).
7. **Independent review before commit** — have a _different_ agent or a human review the diff **against
   the spec rule table**, not against "looks reasonable." (Claude Code: the `safety-rule-reviewer`
   agent. Other tools: a second model or a human. Output a clear PASS/FAIL.)
8. **Bounded autonomy** — never let an automated loop "fix" failing safety logic more than **once**;
   on a second failure, **stop and escalate to a human**. A loop can "fix" a safety test by weakening
   it — don't allow that.

## Done means

Gate green **and** 100% branch on the file **and** an independent review that says PASS against the
canonical rules. Anything less, escalate.
