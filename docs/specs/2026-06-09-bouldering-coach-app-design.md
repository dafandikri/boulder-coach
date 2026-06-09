# Bouldering Coach App — Design Spec

**Date:** 2026-06-09
**Status:** Approved (design) — pending implementation plan
**Author:** dafandikri

## Problem

Training for bouldering with no structure leads to compounding problems:

- **No program / unstructured plan** — every session is improvised.
- **No warm-up routine** — climbing cold.
- **Recurring injuries** — finger (PIP joint swelling / synovitis, A2 pulley), TFCC (ulnar wrist), shoulder.
- **Plateauing** — grades stop improving (stuck in the V4–V6 zone).
- **No technique development** — no deliberate skill practice.

Existing apps don't close the loop: Crimpd/Lattice give structured _sessions_ but don't adapt to the individual or check technique; Kaya/Stökt are social _logbooks_; newer "AI" apps do video _form-checking_ but no programming. **None tie warm-up → adaptive program → load management → injury prevention into one personal feedback loop.**

## Goal (v1)

Deliver **"the program"**: an app that tells the user exactly what to do today, adapts to performance _and_ how they feel, and keeps them out of injury — for an **intermediate (V4–V6) climber training at a commercial bouldering gym with no hangboard/board/weights, 2–4 sessions/week.**

Non-goals for v1 (deferred): video/technique form-checking, ML-based adaptation, multi-user/cloud accounts, social features, route/outdoor logging.

## Decisions (from brainstorming)

| Decision             | Choice                                                                                          | Rationale                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| v1 core loop         | **The program** ("tell me what to do today")                                                    | Highest day-one value for plateau + structure.                                     |
| Adaptivity           | **Performance + how you feel** (auto-deload/swap on injury flags)                               | Most valuable; what no app does.                                                   |
| Engine               | **Transparent rules engine (Approach B)** — no ML                                               | Trustworthy for injury decisions; no cold-start; buildable offline.                |
| Audience             | **Me now, shareable later**                                                                     | Local-first, but clean data layer for future cloud/multi-user.                     |
| Stack                | **Next.js PWA + TypeScript**, IndexedDB (Dexie) behind a repository interface, deploy on Vercel | Installable, offline at the gym, single codebase, swap to cloud later.             |
| Equipment assumption | **Gym floor only** (no hangboard/board/weights)                                                 | Program prescribes on-the-wall + bodyweight/band work only. Safer for fingers too. |

## Architecture

Layered, with pure domain logic decoupled from storage:

```
UI  — Next.js App Router pages (PWA)        screens, check-in, session player
────────────────────────────────────────────
Domain (pure TypeScript, no I/O — testable)
  • periodization → generates the weeks
  • adaptation    → adjusts TODAY's session   (the rules engine)
  • loadMetrics   → sRPE, ACWR, deload trigger
  • warmup        → builds the RAMP routine
────────────────────────────────────────────
Repository interface (IClimbRepo) — swap point
  └ IndexedDB/Dexie impl now → cloud impl later
```

- **Domain = pure functions.** Take data in, return decisions out, touch no storage. Makes every rule unit-testable and makes "shareable later" a swap of the repository impl, not a rewrite.
- **`IClimbRepo`** is the entire forward-compat investment: Dexie impl today, Postgres/Supabase impl behind the same interface later, domain untouched.

## Data Model

| Entity                   | Fields (core)                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `UserProfile`            | currentGrade (V-scale), goalGrade, availableWeekdays, sessionsPerWeek, injuryHistory[], startDate                             |
| `Program`                | id, startDate, lengthWeeks (6), periodizationModel, currentWeekIndex, status                                                  |
| `PlannedSession`         | programId, weekIndex, dayIndex, type, targetMetrics, blocks[]                                                                 |
| `CheckIn`                | date, sleepQuality, overallFatigue, soreness map (PIP/wrist-TFCC/shoulder/elbow), painFlags (location + severity), motivation |
| `SessionLog`             | date, plannedSessionId?, warmupCompleted, blocks[] (sets, grades attempted/sent, RPE), sessionRPE, durationMin, notes         |
| `LoadMetrics` (derived)  | dailyLoad = sRPE × durationMin, acute7d, chronic28d, **ACWR**                                                                 |
| `Drill` (seeded library) | name, skillCategory (technique / prehab), description, cues                                                                   |

Session types: `limit-boulder` (max strength/power), `power-endurance` (4×4), `volume-technique`, `antagonist-prehab`.

## Program Content (periodization)

Tuned for V4–V6, gym-only, no equipment.

- **6-week mesocycle, concurrent + waved:** `hard · hard · deload · hard · peak · deload`.
- **Session types scale to weekly count (2→4):**
  - 2/week: Limit bouldering + Power-endurance(4×4)/technique.
  - 3/week: add Volume/technique day.
  - 4/week: add Antagonist/prehab + skills day.
- **Every session opens with the RAMP warm-up** (finger-specific, open-hand first).
- **Antagonist/prehab** (shoulder, wrist/TFCC, finger-extensor) baked into cooldowns — bodyweight/band, no equipment required.

## Adaptive Rules Engine

`adapt(plannedSession, checkIn, recentLogs, loadMetrics) → { adjustedSession, changes[] }`

Pure function. Rules evaluated in **priority order (safety first)**; each change carries a human-readable reason.

| #   | Trigger                                    | Action                                                                                                                                                                       | Reason (example)                                                    |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Sharp pain flag (PIP/pulley/TFCC/shoulder) | Remove aggravating blocks (crimps; loaded underclings/slopers for TFCC; overhead for shoulder), **cut volume 50%**, swap in prehab + technique; suggest physio if persistent | "Wrist pain flagged — removed sloper limit work, added ECU prehab." |
| 2   | Soreness, no sharp pain                    | Swap grip type (crimp→open-hand for sore PIP), intensity −1 notch                                                                                                            | "PIP sore — open-hand only today."                                  |
| 3   | ACWR > 1.5                                 | Force deload: volume −40%, easy intensity                                                                                                                                    | "Load ratio hit 1.6 — deloading."                                   |
| 4   | ACWR 1.3–1.5                               | Cap intensity, no new max attempts                                                                                                                                           | "Load creeping up — holding steady."                                |
| 5   | High fatigue / poor sleep                  | Volume −20%, lower RPE target                                                                                                                                                | "Rough sleep — trimmed volume."                                     |
| 6   | Crushing targets (hit all, low RPE)        | Progress: +grade or +volume                                                                                                                                                  | "You're flashing targets — bumping the grade."                      |
| 7   | Missing targets repeatedly                 | Slight regress / more rest                                                                                                                                                   | "Adjusted down to rebuild momentum."                                |
| 8   | Default                                    | Deliver as planned                                                                                                                                                           | —                                                                   |

Warm-up becomes **non-skippable** when rule 1 or 2 fires.

### ACWR & load math

- Daily load = sessionRPE (1–10) × durationMin.
- Acute = 7-day rolling sum; Chronic = 28-day rolling average (weekly-equivalent).
- ACWR = acute / chronic. Target band **0.8–1.3**; >1.5 = high injury risk → force deload.

## Warm-up Generator (RAMP)

- **Raise:** 5–10 min cardio.
- **Activate / Mobilize:** dynamic shoulder/wrist/finger mobility + tendon glides.
- **Potentiate:** 8–12 easy problems, low→high intensity, open-hand first.
- Adds extra mobilization + more conservative potentiate when an injury flag is active.

## Screens (mobile-first PWA)

1. **Today** — hero card: today's session (or recovery if rest day) → "Start".
2. **Check-in** (30s) — sleep/fatigue sliders + tap-a-body-map for soreness/pain.
3. **Session player** — warm-up checklist → each block with targets, log actuals (grades/attempts/RPE), rest timer, adaptation banner.
4. **History** — past sessions.
5. **Insights** — ACWR gauge (green/amber/red), grade pyramid, soreness trends, the "why" log.
6. **Program** — 6-week calendar + current position.
7. **Drills** — technique + prehab reference library.

## Edge Cases

- **Missed sessions** → engine recalculates (ACWR drops naturally, re-ramps gently); no blind shifting.
- **Skipped check-in** → assume neutral, flag the assumption.
- **Cold start (no data)** → week 1 is a conservative calibration baseline.
- **Long layoff** → detect gap, restart with deloaded ramp.
- **Offline** → all writes local-first.

## Testing Strategy

Integration-first (per project preference):

- Drive the domain engine end-to-end: given check-in + logs + metrics → assert adjusted session + reasons.
- **Every safety rule gets an explicit test** (pain flags especially).
- ACWR math tests.
- Lighter component tests on screens.

## How v1 addresses each original problem

| Problem                   | v1 mechanism                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| No program / unstructured | Periodized 6-week mesocycle, today's session always defined                                         |
| No warm-up                | Mandatory RAMP generator each session                                                               |
| Finger / PIP injuries     | Open-hand-first warm-up, soreness→grip swap, pain→volume cut 50%, ACWR guardrails                   |
| TFCC / wrist              | Pain flag removes loaded underclings/slopers, adds ECU/pronator prehab                              |
| Shoulder                  | Antagonist/prehab in cooldowns; pain flag removes overhead work                                     |
| Plateau / grades          | Concurrent periodization + progressive overload via performance rules + benchmark targets           |
| Technique                 | Volume/technique sessions with drill focus + drills library (deferred deep coaching to later phase) |

## Sources (research)

- TrainingBeta — Performance Bouldering Program: https://www.trainingbeta.com/bouldering-training/
- Eric Hörst — Free training programs: https://trainingforclimbing.com/training-programs/
- Climbing.com — Break through training plateau: https://www.climbing.com/skills/break-through-training-plateau/
- RAMP warm-up: https://rockclimbingrealms.com/rock-climbing-warm-up-hacks/
- Hörst — Finger warm-ups: https://trainingforclimbing.com/finger-warm-ups/
- Climbing.com — Pulley injuries: https://www.climbing.com/skills/how-to-prevent-treat-finger-flexor-pulley-injuries/
- PIP synovitis rehab: https://www.completeclimber.com/blog/what-is-pip-synovitis-plus-helpful-techniques-you-can-use-to-rehab-this-finger-injury
- Hooper's Beta — TFCC recovery: https://www.hoopersbeta.com/library/how-to-fix-ulnar-wrist-pain-tfcc-injury-recovery-guide
- 99Boulders — Footwork drills: https://www.99boulders.com/bouldering-footwork-drills
- Lattice — Keeping a training log: https://latticetraining.com/blog/training-tips-for-climbers-keeping-a-training-log/
- ClimbMax — overtraining flags: https://climbmax.app/
- Titans Grip — Best bouldering app 2026: https://www.titans-grip.com/blog/best-bouldering-app-2026/
