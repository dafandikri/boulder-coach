# Persistent-Pain Escalation — Design Spec (BC-73)

**Date:** 2026-06-23
**Status:** Design drafted (PO diagnosis) — pending implementation plan
**Author:** dafandikri (product) · drafted by Claude Opus 4.8 in a PO grooming pass

## Problem

The app's core promise is **"keeps you out of injury."** The same-day rules engine
(`adaptation.ts`, rule 1) already responds to a pain flag _today_: it cuts volume 50%, forces
open-hand only, adds prehab, and the reason string says _"see a physio if it persists."_ But
**nothing detects persistence.** A climber who flags the same body part (finger/PIP, wrist/TFCC,
shoulder, elbow) in check-in after check-in receives the **identical gentle same-day handling each
time**, with no escalation. The "if it persists" clause is a passive string, not a behaviour.

That is the exact gap between a tweak and a real injury. The difference between "my finger was a bit
sore Tuesday" and "my finger has hurt every session for two weeks" is the single most important
injury signal a bouldering coach can act on — and the app currently treats them the same. A
recurring A2 pulley / PIP synovitis / TFCC problem is precisely what the product exists to prevent,
and it is being silently under-served.

## Goal

Detect when a pain flag for one body part **persists across multiple recent check-ins** and
**escalate** beyond the same-day adaptation: a clear, distinct, harder-hitting message that this is
now a pattern, plus a more conservative recommendation (real rest + see a professional). The
escalation is **additive-safety only** — it can make today strictly easier/safer, never harder.

Non-goals: diagnosing the injury, medical advice beyond "rest and see a climbing physio", or
tracking pain after it stops being flagged (no "injury history journal" here — that is BC-29's
domain). This feature watches the **recent check-in series** and escalates while pain is active.

## Decisions

| Decision              | Choice                                                                                                                                 | Rationale                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the logic lives | **New pure module `src/domain/painTrend.ts`** — NOT `adaptation.ts`                                                                    | Keeps the guarded safety file focused on same-day single-check-in rules; `painTrend` reads the multi-day `CheckIn[]` series. Mirrors how BC-29 `injuryBaseline.ts` stayed out of `adaptation.ts`.                     |
| Input                 | The stored `CheckIn[]` series (`IClimbRepo.getCheckIns()`), `asOf`                                                                     | Pure, `asOf`-driven, no I/O; check-ins are already persisted and queryable.                                                                                                                                           |
| Persistence threshold | A body part flagged with pain in **≥ 3 check-ins within the last 14 days**                                                             | 3 strikes = a pattern, not a one-off; the 14-day window matches a training fortnight and avoids escalating on a months-old flare that already resolved. (Exact numbers are constants, tuned in the plan; start here.) |
| Severity              | Escalate on **any** pain flag persistence; if severities are recorded, surface the **max**                                             | Pain that keeps coming back matters even at low severity — recurrence is the signal, not peak intensity.                                                                                                              |
| Intervention strength | **Strong recommendation, not silent force** (see "Escalation behaviour")                                                               | Respect user agency; an injury-prevention app that nukes the plan unprompted erodes trust. We escalate the message + cap intensity hard, and recommend rest, but do not fabricate a workout the user didn't choose.   |
| Surfacing             | `TodayResult.persistentPain` → a distinct **danger** Callout on Today AND in the session player (pairs with BC-72's adaptation banner) | The player is where the climber acts; the warning must follow them past "Start".                                                                                                                                      |

## The pure detector

```
// src/domain/painTrend.ts  (pure, asOf-driven, no I/O)

export interface PersistentPain {
  part: BodyPart;          // the most-concerning persistent part
  sessions: number;        // how many of the recent check-ins flagged it
  windowDays: number;      // the lookback window used (for the copy)
}

export function assessPersistentPain(
  checkIns: CheckIn[],
  asOf: Date,
): PersistentPain | null;
```

- Consider only check-ins within `PAIN_WINDOW_DAYS` (14) of `asOf`, ignoring future-dated rows
  (mirrors how `loadMetrics`/`detectLayoff` age data).
- For each `BodyPart`, count check-ins in-window where `pain[part]` is truthy.
- If the max count `≥ PAIN_PERSISTENCE_SESSIONS` (3), return that part (ties → the most
  injury-sensitive part wins: finger/PIP → wrist/TFCC → shoulder → elbow, matching the rules
  engine's seriousness ordering). Otherwise `null`.
- Cold start / sparse data → `null` (never a false alarm; never NaN).

## Escalation behaviour

When `assessPersistentPain` returns non-null, `getTodaySession` surfaces it and the UI escalates:

1. **A distinct `danger` Callout** (not the gentle info/amber the same-day adaptation uses), copy
   like: _"You've flagged {part} pain in {n} of your recent sessions. That's a pattern, not a
   tweak — take real rest and see a climbing physio before pushing again."_ Shown on **Today** and
   carried into the **session player** (BC-72).
2. **Warm-up becomes mandatory** (reuse the existing `warmupMandatory` flag) and **intensity is
   capped hard** — no max-effort, no limit/PE, today reads as recovery/rehab-leaning. Because rule 1
   already fires on the same-day flag, the _additional_ behaviour here is (a) the escalated message
   and (b) ensuring the cap holds even on a day the user did **not** re-flag pain in the check-in but
   the recent pattern says they should still back off.
3. **No silent session rewrite.** We do not invent a rehab workout; we strongly recommend rest and
   make the safe choice the easy one. (A future enhancement could offer a one-tap "switch to a
   rehab day" using `schedule.ts`'s recovery block — left out of v1 to keep the change additive and
   trust-preserving.)

**Additive-safety invariant (tested):** for any check-in series, the presence of persistent-pain
escalation may only lower today's intensity/volume or leave it unchanged — never raise it. This
keeps the feature out of `adaptation.ts`/`loadMetrics.ts` (no safety-reviewer gate), consistent with
BC-29 and BC-63.

## Surfacing / wiring

- `src/app/lib/bootstrap.ts` (`getTodaySession`) reads `getCheckIns()`, calls `assessPersistentPain`,
  and sets `TodayResult.persistentPain: PersistentPain | null`. If non-null, it also forces
  `warmupMandatory = true` and ensures no max-effort block survives (cap targetRPE / drop limit-PE) —
  applied in the app layer over the already-adapted session, so the safety file is untouched.
- `src/app/page.tsx` renders the danger Callout when `persistentPain` is set.
- `src/app/session/page.tsx` renders the same escalation banner (depends on **BC-72**, which brings
  the adaptation banner into the player — persistent-pain rides the same surface).

## Testing strategy

- `tests/domain/painTrend.test.ts`: the threshold boundary (2 flags → null, 3 → escalate); the
  window edge (a 15-day-old flag excluded); future-dated rows ignored; tie-break ordering
  (finger beats shoulder); cold-start/empty → null; a part that was flagged then stopped (only old
  flags) → null.
- `tests/app/bootstrap.test.ts`: persistent pain surfaces on `TodayResult`, forces `warmupMandatory`,
  and the additive-safety invariant (today is never harder than without the escalation).
- The detector is pure and 100%-coverable; no React harness needed for the decision logic.

## How this addresses the original promise

| Promise (spec)            | Before                                                       | After (BC-73)                                                                                                        |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| "keeps you out of injury" | Same-day adaptation only; "see a physio" is a passive string | Multi-session pain **pattern detected** and **escalated** to rest + professional referral, with a hard intensity cap |

## Open questions (resolved by this spec)

- **Force a rehab day vs recommend?** → **Recommend + hard-cap** for v1 (trust-preserving, additive).
  Auto-switching to a rehab session is a fast-follow if users ask for it.
- **Where does the logic live?** → **`painTrend.ts` (new pure module)**, not the guarded
  `adaptation.ts`. The app layer applies the cap, so no safety-reviewer gate is triggered.

## Files (for the eventual plan)

`src/domain/painTrend.ts`, `src/app/lib/bootstrap.ts`, `src/app/page.tsx`,
`src/app/session/page.tsx` (BC-72 surface), `tests/domain/painTrend.test.ts`,
`tests/app/bootstrap.test.ts`.
