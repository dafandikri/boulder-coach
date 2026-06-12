# Research — best-practice indoor bouldering programming

**Date:** 2026-06-13 · **Author:** Claude Opus 4.8 (product/research session)
**Trigger:** PO feedback after using the live app (grades too high a floor, frequency too narrow,
"Start" is vague, the program reads the same every week, drills/prehab lack detail/images, Insights
wants a graph + a personalised summary).
**Purpose:** ground the new backlog PBIs (**BC-44…BC-51**) in coaching evidence, not vibes. Every
recommendation below is cited and mapped to a concrete app gap + the PBI that closes it.

> This is a **findings document**, not a spec. The design spec of record is
> [`specs/2026-06-09-bouldering-coach-app-design.md`](../specs/2026-06-09-bouldering-coach-app-design.md);
> the canonical injury-safety rule table lives there and is **not** weakened by anything here.
> Where a finding would touch `adaptation.ts`/`loadMetrics.ts` it is flagged as safety-critical.

---

## 0. How the current app measures up (verified against the code, 2026-06-13)

| Area              | Best practice (see below)                                        | App today                                                                                              | Gap → PBI                                |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Grade floor       | Beginners start at **VB / V0**                                   | `MIN_GRADE = 1` in `bootstrap.ts`; `Math.max(1, …)` floors everywhere; `GradePill` renders `V{n}` only | **BC-44**                                |
| Frequency         | 1 quality session/wk is valid; advanced do 5–6, with load care   | `sessionsPerWeek` clamped **2..4**; `sessionPlanFor` only handles 2/3/4                                | **BC-45**                                |
| Exercise guidance | Each drill needs sets/reps/rest + form cues + a picture          | `Block.notes` is one line; no images, no steps                                                         | **BC-46, BC-47**                         |
| Week-to-week      | Mesocycle **progresses** week to week (overload, drill rotation) | `generateProgram` emits identical blocks every week; only a phase volume multiplier changes            | **BC-48**                                |
| Drills            | Step-by-step + common mistakes + images                          | `drills.ts`: `description` + `cues[]`, no images/steps/detail view                                     | **BC-49**                                |
| Prehab/off-wall   | Dosage (sets×reps), how-to, images                               | `offWallExercises.ts`: one-line `description`, no dosage/images                                        | **BC-50**                                |
| Insights          | A **trend graph** + a plain-language read                        | `StatCard`/`ProgressBar` point-in-time numbers only                                                    | **BC-38** (charts) + **BC-51** (summary) |

---

## 1. The V-scale floor — VB and V0 are the beginner grades the app omits

- The V-scale (John "Vermin" Sherman, Hueco Tanks) is the dominant US/indoor bouldering scale. The
  **easiest grades are VB (V-Basic) and V0**; V0 is "good holds, straightforward movement, attemptable
  on day one," and **most beginners live at V0–V1**. The scale has **no +/- modifiers** (a problem is
  V5 or V6).
- **App gap:** `bootstrap.ts` sets `MIN_GRADE = 1`, `validateProfile` rejects anything below V1, and
  `periodization.ts`/`session/page.tsx` floor targets with `Math.max(1, …)`. A genuine beginner can't
  even enter their grade, and every prescription bottoms out at V1.
- **Implication for BC-44:** extend the scale **below** 1. `VGrade` is already a bare `number`, so the
  cheap encoding is `V0 = 0`, `VB = -1`, with a single `formatGrade(g) → g < 0 ? 'VB' : 'V'+g` render
  helper (replacing the inline `` `V${grade}` `` in `GradePill`) and a `MIN_GRADE = -1` constant that the
  `Math.max(…)` floors read instead of the literal `1`. Onboarding/profile gain VB & V0 options.

## 2. Periodization — macro / meso / micro, and why "every week the same" is a real bug

- Training nests as **macrocycle** (months→year) → **mesocycles** (3–12-wk focused blocks) →
  **microcycles** (1 wk). The app's 6-week `PHASE_PATTERN` (`hard, hard, deload, hard, peak, deload`)
  with a roll-forward is a sound **mesocycle** shape and should stay.
- **But within a mesocycle the load must progress** — the recommended pattern cycles through phases
  with built-in overload, not a constant week repeated. The app's `generateProgram` produces the
  **identical** `mainBlocksFor(...)` blocks for every week of a phase; only `PHASE_VOLUME` scales the
  set count. So a "hard" week 1 and "hard" week 4 are byte-identical except volume — which is exactly
  the "the program is still badly texted, every week is the same" complaint, and it under-delivers
  progressive overload.
- **Models:** _Linear_ periodization (high-volume/low-intensity → low-volume/high-intensity) suits
  **beginners**; _non-linear / Daily-Undulating (DUP)_ — varying the energy-system focus across the
  week — suits **intermediates**. Core DUP tenet: **never train the same energy system on consecutive
  days**, and **never limit-boulder two days in a row** (≤2×/week).
- **Implication for BC-48:** make week index a real input to block generation — progress intensity/
  volume across a phase (e.g. week-on-week target-RPE or set ramp), **rotate the technique drill**
  (ties to the already-open **BC-19**) and prehab focus so consecutive weeks differ, and surface this
  in a **clickable program** view (week → session → the actual blocks with instructions/images).

## 3. Session structures with concrete, citable parameters (feed BC-46/47/48)

These are the numbers the session player should _show the user_, not bury in a one-line note.

**Warm-up (≥ ~20 min, every session):** pulse-raiser → dynamic mobility of the major groups →
activation (TRX/band **Y-I-T**, rotator-cuff) → easy boulders ramping up → a few easy fingerboard
hangs (advanced only; **beginners: no campus board, ultra-safe hangboard only**).

**Limit bouldering (alactic / max strength):** problems of **3–5 moves at your absolute limit**;
**fatigue has no place** — rest **3–5 min between attempts**; **never two days in a row**, **≤ 2×/wk**.
Keep total volume low.

**Power-endurance — the 4×4 (lactic):** pick **4 boulders a touch below flash**, climb them
**back-to-back with no rest**, then **rest 4 min**, and repeat for **4 total sets**. Precede with a
full warm-up **+ ~20 min hard bouldering + 10 min rest**. Sets 3–4 should feel very pumped but not
repeatedly falling.

**Volume / technique (aerobic / skill):** **10–20 boulders 3–4 grades below flash**, pick **1–2
technique intentions** (footwork, heel hooks, lock-offs), climb with **generous rest — do not build
fatigue**.

**Session-wide:** rest **2–3 min between exercises**; total **~60–90 min after warm-up**; **one energy
system per session** (don't mix limit + PE + endurance in one day).

**Weekly mix (energy-system spread):** ~**2 alactic (limit)** + **1–2 lactic (PE)** + **1 aerobic**,
spaced so hard systems aren't back-to-back. This is what makes **1×/week** legitimate (a single quality
session) and frequencies of **5–7×** demanding enough to **require explicit load-management notes** —
exactly the "1x or even 7x but with notes of course" the PO asked for (**BC-45**).

## 4. Beginner safety guardrails (reinforce the existing safety contract)

- Beginners: **build a movement foundation first**; **no campus board**; hangboarding only via
  ultra-safe protocols. This _agrees with_ the app's existing additive-only / injury-first stance —
  BC-44's lower grades must inherit the same conservatism (a VB/V0 climber should get **more**
  technique/volume and **less** limit intensity, never the reverse). Any change that reaches
  `adaptation.ts`/`loadMetrics.ts` stays safety-critical (skill + reviewer + 100% branch).

## 5. Insights — a graph _and_ a plain-language read

- Coaching value is in the **trend**, not a single number: load over weeks, ACWR trajectory toward/away
  from the 0.8–1.3 band, soreness frequency by body part (**BC-38** charts). On top of the chart,
  climbers benefit from a **one-paragraph personalised read** ("your V4 base is broad — start touching
  V6; load is climbing, keep a rest day this week"). That summary is a **deterministic, on-device**
  analyser over the same series (**BC-51**) — distinct from the future **AI-narrated** weekly review
  (**BC-42**), which is the LLM version of the same idea and must never invent advice that bypasses the
  rules engine.

---

## 6. Findings → backlog map (added this session)

- **BC-44** — VB/V0 grade-scale extension (onboarding, validation, `GradePill`, floors).
- **BC-45** — `sessionsPerWeek` 1–7 with frequency guidance + high-frequency load notes.
- **BC-46** — shared **exercise content model** (structured steps + dosage + image convention + a
  reusable `ExerciseDetail` surface) — the foundation BC-47/48/49/50 build on (don't re-implement 4×).
- **BC-47** — rich session player: detailed todos / instructions / form cues / images per block
  (closes "Start is vague").
- **BC-48** — week-to-week program variation (progressive overload + drill/prehab rotation) **and** a
  clickable program → session → blocks view (closes "every week the same / can't drill into the
  program"). Cross-refs **BC-19** (drill rotation).
- **BC-49** — drills: step-by-step instructions, common mistakes, images, a drill detail view.
- **BC-50** — prehab/off-wall: sets×reps dosage, how-to steps, images, detail view.
- **BC-51** — personalised Insights analyser summary (deterministic, on-device) — pairs with **BC-38**
  charts; deterministic sibling of the future **BC-42** AI review.

---

## Appendix A — A copy-ready reference mesocycle (feeds BC-47 / BC-48)

A worked example the BC-47/BC-48 implementer can lift directly, synthesised from the cited programs
(Climbing House 18-week; Hörst _Training for Climbing_; Lattice). It shows the two things the app is
missing: **per-session detail with numbers** (BC-47) and **week-to-week progression** within a phase
(BC-48). Mirror it onto the existing 6-week `PHASE_PATTERN` (`hard, hard, deload, hard, peak, deload`).

**Per-session templates (the numbers BC-47 should render on each block):**

- **Warm-up (every session, ~20 min):** 5 min pulse-raiser → joint mobility → band Y-I-T + rotator
  cuff (2×10) → easy boulders ramping VB→V2→… → (advanced only) 2–3 easy fingerboard hangs. Beginners:
  **no campus, no max hangs.**
- **Limit boulder:** 4–6 problems of **3–5 moves at your limit**, **3–5 min rest** between attempts,
  shoes off while resting. Stop on form breakdown. ~60–90 min.
- **Power-endurance 4×4:** **4 boulders just below flash**, back-to-back no rest = 1 set; **4 min rest**;
  **×4 sets**. (Precede with warm-up + ~20 min hard bouldering + 10 min rest.)
- **Volume / technique:** **10–20 boulders 3–4 grades below flash**, pick **1–2 intentions** (silent
  feet / heel hooks / lock-offs), **generous rest — don't pump out**.
- **Antagonist/prehab (off-wall, additive only):** push 3×8–12, rows/face-pulls 3×12, finger-extensor
  band 2×15, rotator-cuff 2×12, core 3 × quality. (Lifting-day dosage from Climbing House: pull-ups
  3×4, DB row 3×6, press 3×6, triceps 3×8.)

**Week-to-week progression within a "hard" phase (this is what BC-48 must add — today it's flat):**

| Week | Phase      | Limit                                                            | Power-endurance                    | Volume          | Drill focus (rotates)   |
| ---- | ---------- | ---------------------------------------------------------------- | ---------------------------------- | --------------- | ----------------------- |
| 1    | hard       | 4 problems @ limit                                               | 4×4 @ 3 sets                       | 12 climbs       | silent feet             |
| 2    | hard       | 5 problems @ limit                                               | 4×4 @ 4 sets                       | 14 climbs       | heel/toe hooks          |
| 3    | **deload** | 2 easy fun sessions, mobility only — **no structured intensity** | —                                  | —               | —                       |
| 4    | hard       | 6 problems, +1 grade attempts                                    | 4×4 @ 4 sets, boulders +0.5 grade  | 16 climbs       | lock-offs / deadpoints  |
| 5    | **peak**   | limit @ current+1, low volume                                    | spray-wall circuits 20–30 moves ×4 | 10 climbs sharp | flagging / body tension |
| 6    | **deload** | 2 easy sessions, taper                                           | —                                  | —               | —                       |

The pattern: **intensity/volume ramp across consecutive hard weeks, a drill that changes each week, a
deload that drops structured load, a peak that trades volume for intensity.** That alone fixes "every
week is the same" — and gives the clickable program (BC-48) real, distinct content to show per week.

**Frequency scaling (BC-45):** at **1×/wk** run the limit session only; **2×** = limit + volume;
**3×** = limit + PE + volume; **4×** add antagonist/prehab; **5–7×** fill with volume/technique +
mobility/recovery and surface the load-management note — **never** add a second limit or PE day
back-to-back (DUP).

## Sources

- [Understanding V-Grades — Movement Gyms](https://blog.movementgyms.com/understanding-v-grades)
- [Bouldering Grades Explained — topbouldering](https://topbouldering.com/bouldering-grades/)
- [What Is the V Scale in Bouldering — DPM Climbing](https://www.dpmclimbing.com/what-is-the-v-scale-in-bouldering/)
- [The climber's guide to periodization — Modus Athletica](https://www.modusathletica.com/blog/the-climber-s-guide-to-periodization-a-focus-for-every-season)
- [Build Your Climbing Plan: A Periodization Framework — Rock Climbing Realms](https://rockclimbingrealms.com/build-your-climbing-plan-a-periodization-framework/)
- [How to Train for Bouldering — Climbing.com](https://www.climbing.com/skills/training/how-train-bouldering/)
- [18-Week Free Climbing Training Program — Climbing House](https://climbinghouse.com/18-week-free-training-program/)
- [Limit Bouldering — Eric Hörst / Training For Climbing](https://trainingforclimbing.com/limit-bouldering-for-building-max-climbing-strength-and-power/)
- [Power-Endurance Training Protocols — Training For Climbing](https://trainingforclimbing.com/power-endurance-training-protocols-for-climbers/)
- [Boost Your Power Endurance with Bouldering 4x4s — Gripped](https://gripped.com/indoor-climbing/boost-your-power-endurance-with-bouldering-4x4s/)
- [How to: Structure Your Training — Lattice Training](https://latticetraining.com/blog/how-to-structure-your-training/)
- [How to Train for Bouldering — Lattice / BMC](https://www.thebmc.co.uk/en/how-to-train-for-bouldering)
