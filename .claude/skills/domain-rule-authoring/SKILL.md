---
name: domain-rule-authoring
description: Use when implementing or editing src/domain/adaptation.ts or src/domain/loadMetrics.ts. Provides the canonical ACWR formulas and the 8-row safety rule table so rules are implemented from source, not paraphrase.
---

# Domain Rule Authoring

When you write the adaptation engine or load metrics, implement from THESE canonical definitions.
Do not paraphrase from memory — paraphrasing is the #1 logged failure mode.

## ACWR / load math

- Daily load = `sessionRPE × durationMin`.
- Acute = sum of loads with `0 <= ageDays < 7`.
- Chronic = (sum of loads with `0 <= ageDays < 28`) ÷ 4.
- ACWR = chronic === 0 ? 0 : round(acute / chronic, 2 decimals).
- Target band 0.8–1.3; `> 1.5` = force deload.

## Rule table (priority order — evaluate top-down, safety first)

| #   | Trigger                        | Action                                                                   |
| --- | ------------------------------ | ------------------------------------------------------------------------ |
| 1   | Sharp pain flag                | volume −50%, grip→open-hand, insert prehab, warmupMandatory=true, return |
| 2   | Soreness, no pain              | grip crimp/mixed→open-hand, RPE −1 (floor 5)                             |
| 3   | ACWR `> 1.5`                   | volume ~−40%, RPE cap 6, return                                          |
| 4   | ACWR `>= 1.3`                  | RPE cap 8, no new max                                                    |
| 5   | fatigue `>= 4` OR sleep `<= 2` | volume −20%, RPE −1 (floor 5)                                            |
| 6   | crushing targets               | progress +grade/+volume                                                  |
| 7   | missing targets                | regress / more rest                                                      |
| 8   | default                        | unchanged                                                                |

## Hard rules

- Threshold operators are EXACT: `> 1.5`, `>= 1.3`. Add a boundary test at exactly 1.3 and 1.5.
- Every change pushes an `{ ruleId, reason }` with a human-readable reason.
- The function is PURE: no I/O, no Date.now() inside (caller passes `asOf`). Clone before mutating.
- Never weaken a test to make it pass. If a test seems wrong, STOP and escalate.
