# HANDOFF — living cursor

**This is the first thing a fresh agent (any model/tool) or human reads to continue work.**
It is the project's working memory: where we are, what's next, and the traps that already bit us.
Plans (`docs/plans/`) describe _features_; the ledger (`docs/LEARNINGS.md`) logs _mistakes_; **this
file is the live position** — update it as the LAST step of any session (see "Definition of done" in
`AGENTS.md`).

> Run `pnpm onboard` before doing anything — it prints this file, the latest learnings, and the gate
> status in one shot. A memoryless agent that runs it starts with the same context the last one ended
> with.

---

## How to continue (every agent, every session)

1. `pnpm onboard` — load context (this file + recent learnings + gate/git state).
2. Read `AGENTS.md` (rules) and the relevant `docs/plans/*` for the feature you're touching.
3. `pnpm learnings <file-or-keyword>` — retrieve only the lessons for what you'll edit (don't read the
   whole ledger). Fix from the lesson, not blind retry.
4. Do the work under TDD; `pnpm gate` must be green before commit (it runs on Stop + pre-push + CI).
5. **Before you stop:** update this file (state + next actions), append a ledger entry for any failure,
   and update `README`/`AGENTS.md`/specs if behavior or infra changed (same commit).

---

## Current state — 2026-06-14 (8 PBIs + ACWR fix/explainers — local, last touched by: Claude Opus 4.8)

- **A large supervised batch landed, all `pnpm gate` green + every separate CI check verified locally.**
  Worked sequentially (NOT parallel agents — the CI-infra PBIs collide on `ci.yml`/`playwright.config`/
  `package.json`, and the ACWR change is a safety file needing serial review). **Not yet committed/pushed** —
  one large local working tree; a supervised commit-per-PBI + push/PR is the next step. BACKLOG marks all
  done.
  - **ACWR cold-start fix (safety, PO-flagged bug)** — `loadMetrics.ts` rewritten to **EWMA-ACWR** (seeded
    so a first week reads ~1.0, not a false 4.0 deload). `safety-rule-reviewer`: PASS. Canonical docs
    (skill + spec + types) updated in lockstep. See LEARNINGS 2026-06-14.
  - **Explainers (RPE + ACWR)** — covered `src/app/lib/explainers.ts` (band logic) + presentational
    `MetricExplainer` with inline-SVG diagrams; surfaced on Today (personalised via new `TodayResult.acwr`)
    and Insights.
  - **BC-29** injury-history baseline (pure `injuryBaseline.ts`, additive-only, round-trips in backup).
  - **BC-32** integrity validator (`integrity.ts`, quarantine on read → `TodayResult.dataIssues`) + v1→v2
    migration test.
  - **BC-33** `error.tsx` + `global-error.tsx` over covered `errorRecovery.ts` (Next 16 `unstable_retry`).
  - **BC-36** bundle budget (gate step 9/9, ~168/200 KB). **BC-35** Stryker on the safety files (90%, sep CI
    job). **BC-37** axe a11y e2e (neutral contrast fixed; brand pairs baselined → BC-25). **BC-16** offline/
    SW/manifest e2e + Lighthouse budgets. **BC-14** branded maskable PWA icons (`pnpm icons`).
- **New deps (all devDependencies, dep-placement guard green):** `@axe-core/playwright`, `@lhci/cli`,
  `@stryker-mutator/{core,vitest-runner}`, `sharp`. New scripts: `bundlesize`, `lighthouse`, `mutation`,
  `icons`. New CI jobs: `lighthouse`, `mutation` (alongside `quality`).
- **Gate-blind / follow-ups:** BC-33 forced-throw e2e descoped (would need a prod throw hook); brand-palette
  contrast is **BC-25** (axe baseline references it); Lighthouse BP=0.96 locally is the localhost Vercel-
  script 404 (deploy = 1.0). Open P2 remaining: BC-25 (dark mode + the a11y contrast pass), BC-38 (charts),
  BC-39 (install prompt).

## Current state — 2026-06-13 (BC-27 benchmark recalibration + BC-31 persistent storage — local, last touched by: Claude Opus 4.8)

- **Two file-adjacent P2 PBIs shipped this session, both TDD, `pnpm gate` green** (format → lint → tsc
  → depcruise → type-coverage → tests+coverage → knip → build all pass; coverage 99.6% lines).
  **Not yet committed/pushed** — local working tree only; a supervised commit-per-PBI + push/PR is the
  next step if you want them on `main`. BACKLOG marks both `done`.
  - **BC-27 (benchmark recalibration)** — pure `assessBenchmark({logs, currentGrade, asOf}) →
{measuredGrade, leveledUp}` in new `src/domain/assessment.ts` (100% branch). Measured grade =
    highest grade SENT in ≥`SESSIONS_TO_CONFIRM`(2) distinct sessions within `LOOKBACK_DAYS`(42).
    **Asymmetric by design:** `leveledUp` is true ONLY when measured > current — never auto-lowers the
    grade (regression is a coach conversation). Surfaced on `TodayResult.assessment` via
    `getTodaySession`; Today shows a success "You've leveled up!" Callout. Accept → covered
    `levelUpProfile(profile, measuredGrade)` (raises current, lifts goal ≥ current) →
    `applyProfile(repo, draft, regenerate=true)` (BC-06 regen) → reload. The "new draft" decision is in
    the covered helper, not the gate-blind page.
  - **BC-31 (persistent storage + eviction warning)** — pure `src/app/lib/storage.ts`:
    `requestPersistence(navigator.storage)` feature-detects + calls `persist()` → `'persisted' |
'transient' | 'unsupported'`; `shouldWarnEviction(state, dismissed)` warns only on `transient` +
    not-dismissed (`unsupported` stays quiet — can't measure, don't cry wolf). Today requests
    persistence on load + renders a dismissible warning Callout. **Closes the cheapest durability win
    before cloud sync (BC-18).** The `StorageManagerLike` structural type lets the async browser I/O be
    fully unit-tested in the node vitest env with a fake.
- **Pattern note:** both follow the established "decision in covered `src/domain` or `src/app/lib`, page
  is a thin wiring layer" rule (universal-quality-bar §2). `levelUpProfile` is tested AND used by the
  page — not re-implemented inline.
- **Remaining open P2:** BC-14 (icons, needs art), BC-16 (e2e in CI), BC-25 (dark mode), BC-29 (injury
  history — safety-adjacent), BC-32 (schema migration), BC-33 (error boundary), BC-35 (mutation testing,
  now P1), BC-36 (bundle budget), BC-37 (a11y gate), BC-38 (Insights charts), BC-39 (install prompt).

## Current state — 2026-06-13 (BC-26 dep-guard + BC-30 pyramid gaps + BC-34 backup nudge — local, last touched by: Claude Opus 4.8)

- **Three file-disjoint P2 PBIs shipped this session, all TDD, `pnpm gate` green** (format → lint →
  tsc → depcruise → type-coverage → tests+coverage → knip → build all pass). **Not yet committed/pushed**
  — local working tree only; a supervised commit-per-PBI + push/PR is the next step if you want them on
  `main`. BACKLOG marks all three `done`.
  - **BC-26 (Tier-1 dep-placement guard)** — `tests/harness/dependency-placement.test.ts` fails the gate
    by name if any data-driven denylist dev tool (`playwright`/`@playwright/test`/`vitest`/`@vitest/*`/
    `eslint*`/`prettier`/`type-coverage`/`knip`/`dependency-cruiser`/`husky`/`lint-staged`/`@types/*`/
    `typescript-eslint`/`fake-indexeddb`) leaks into production `dependencies`. Promotes the BC-11/Copilot
    "review caught what the gate missed" class (LEARNINGS 2026-06-12) to executable. **Closes the
    HANDOFF "e2e tooling can hide in production dependencies" gate-blind risk** (remove it from the open
    list once pushed). Verified non-vacuous by injecting `knip` into prod deps → red.
  - **BC-30 (grade-pyramid target & gaps)** — pure `pyramidTarget`/`pyramidGaps`/`biggestPyramidGap`/
    `describePyramidGap` in `insights.ts` (100% branch); Insights renders a "Pyramid vs your goal"
    overlay card (target-vs-actual bars + the biggest-gap sentence, cold-start safe). Enriches the
    already-shipped BC-51 read.
  - **BC-34 (backup-reminder nudge)** — pure `src/app/lib/backupReminder.ts` (`shouldNudgeBackup` +
    `countSessionsSince` + `isSnoozed`/`snoozeUntilIso`, 100% branch/line); Today shows a dismissible
    "back up your data" Callout, profile export stamps `LAST_EXPORT_KEY` + clears the snooze. Decisions
    in the covered lib; pages do only the localStorage I/O.
- **Gotcha logged (LEARNINGS 2026-06-13):** under `noUncheckedIndexedAccess`, a computed tuple index is
  `T | undefined` regardless of guards — build values via `.map`/iteration, not `arr[i]` + a dead
  `?? 0`. Hit once in `pyramidTarget` and in the test assertions; fixed by `slice().map()` and
  full-array `toEqual`.
- **Note on BC-34's declared `Files:`** — implementation also touched `src/app/profile/page.tsx` (the
  export stamp), one file beyond the backlog's declared set; harmless now it's `done`, but a reminder
  that the page wiring for a `lib`-centric PBI can spill one surface wider than declared.

## Current state — 2026-06-13 (BC-53 copy fix + BC-28 readiness + BC-40 consistency — PR #37, last touched by: Claude Opus 4.8)

- **PO feedback on BC-53's program copy — fixed.** The old line "Build 1 · base volume · focus: Silent
  feet" mislabelled the volume-day's rotating drill as the whole week's focus. Replaced
  `weekHeadline(week): string` with **`weekSummary(week): { title, detail }`** — `title` ("Build 1" /
  "Deload" / "Peak") becomes the week Badge; `detail` is an honest "what to do this week + why" sentence
  (no drill mislabel). Builds 1/2/3 and the two deloads (mid-cycle vs end-of-cycle) all read distinctly.
  Program card renders title-as-badge + the detail sentence. Tests updated; `periodization.ts` branch
  coverage back ≥90%.
- **BC-28 (Readiness on Today) — done.** Pure `computeReadiness(checkIn, metrics) → { score, band,
drivers }` in `src/domain/readiness.ts`; safety bias (sharp pain or ACWR > 1.5 → `red`, mirroring
  adaptation rules 1 & 3). `getTodaySession` surfaces it on `TodayResult` from the **real** check-in
  only (neutral day → `null`, no fake green; rest day → `null`). New gate-blind `ReadinessCard` renders
  band/score/bar + top 2 drivers.
- **BC-40 (Consistency/streak on Today) — done.** Pure `computeConsistency(logs, profile, asOf)` →
  this-week count vs target + a streak of consecutive weeks meeting target (the in-progress current week
  never breaks it). Rendered on Today as "X / Y sessions" + a `ProgressBar` + a supportive 🔥 streak line.
- **TDD throughout:** new `readiness.test.ts` (9) + `consistency.test.ts` (8) + extended
  `bootstrap.test.ts` (readiness null-on-neutral / real-on-checkin, rest-day) + rewritten BC-53 tests.
  `pnpm gate` green (294 tests, build OK). Coverage note: removed an unreachable defensive branch in
  `consistency.ts` (`isoDayStart` now parses via a local-midnight string, no `??` fallbacks).
- **Shipped via PR #37** — `weekHeadline`→`weekSummary` is a public-API rename in `periodization.ts`
  (consumed by `program/page.tsx`); BACKLOG marks BC-28/BC-40 `done (PR #37)`. Reviewed + merged once
  CI green.

## Current state — 2026-06-13 (BC-52/53/54 shipped — content-fidelity defects fixed, PR #36, last touched by: Claude Opus 4.8)

- **The three PO-round-2 defect PBIs are fixed and shipped via PR #36** (squashed commit `0723747`,
  CI `quality` + GitGuardian + Vercel all green). Done as one cohesive change set (BC-54 depends on
  BC-52; BC-53 relies on BC-52's notes rendering):
  - **BC-52 (P1)** — warm-up (`generateWarmup`), cooldown (`cooldownPrehab`), and rest-day
    (`recoveryBlock` in `schedule.ts`) blocks now carry BC-46 `ExerciseContent` (`steps`/`cues`/
    `commonMistakes` + `imageId`) at `mainContentFor` quality, so the player's "How to do this" →
    `ExerciseDetail` appears for them. New SVGs: `warmup-{raise,mobilize,potentiate}`,
    `cooldown-prehab`, `active-recovery`. Invariant tests now assert **every** block in a generated
    session is `hasRichContent` (no block ships detail-less).
  - **BC-53 (P2)** — pure `weekHeadline(week)` in `periodization.ts` gives each program week a
    **differentiating** one-liner (build ordinal + overload cue `base volume`/`+1 set`/`+2 sets`/
    `recover` + rotating drill focus); the week card renders it instead of the constant session-type
    rotation. Same-phase weeks (0 vs 3) now read differently. Drill-down renders `notes` via
    `BlockSummary`.
  - **BC-54 (P2/S)** — new presentational `src/app/components/BlockSummary.tsx` (name + badge +
    target + `notes` + optional how-to slot) is now the single render path for all three surfaces
    (Today / session player / program preview), killing the drift that caused BC-52. `leading` =
    warm-up checkbox; `showGrade={false}` keeps Today's `GradePill`.
- **Also fixed the stale nit:** `UserProfile.sessionsPerWeek` comment `// 2..4` → `// 1..7 (BC-45)`.
- **Coverage note:** `weekHeadline`'s singular-vs-plural overload branch (`+1 set` vs `+2 sets`) needs
  an explicit test (week 1 = 2nd hard week) to keep `periodization.ts` ≥90% branch — it's there.
  The two unreachable `default` returns in `mainContentFor`/`mainBlocksFor` (lines ~179/271) remain
  the only uncovered branches; the file still clears 90%.
- **`pnpm gate` green** (272 tests, build OK); CI green on PR #36. Reviewed (diff scrutinised:
  faithful to the implementation, no stray edits, no `any`, all three surfaces routed through
  `BlockSummary`) and merged to `main`. BACKLOG entries marked `done (PR #36)`.
- **Next open work** is unrelated P2/P3: data-safety (BC-31/32/33/34), harness (BC-26/35/36/37),
  Insights charts (BC-38), training depth (BC-27/28/29/30/40), dark mode (BC-25), PWA polish
  (BC-14/16/39). Consider condensing BC-44…BC-54 into the Shipped log next grooming pass.

## Current state — 2026-06-13 (PO feedback round 2 — 3 defect PBIs filed, last touched by: Claude Opus 4.8)

- **Backlog grooming only (no code changed). Filed BC-52…BC-54 — verified defects in already-`done`
  PBIs (BC-47, BC-48)** found from continued hands-on use. The right _shape_ shipped, but:
  - **BC-52 (P1) — warm-up/cooldown detail vanishes on "Start".** Home page renders `Block.notes`
    (`page.tsx:160`), but the **session player never renders `notes`** and BC-47's `mainContentFor`
    only populated `category:'main'` blocks — `generateWarmup()`/`cooldownPrehab()` set no
    `ExerciseContent`, so warm-up/cooldown fail the `hasRichContent` guard (`session/page.tsx:309`)
    → bare label, no how-to, note dropped. Fix: give warm-up/cooldown real `ExerciseContent` +
    render the summary so the player never shows less than Today.
  - **BC-53 (P2) — the 6-week program reads identically every week.** The week summary renders only
    the constant session-type rotation (`program/page.tsx:177`); BC-48's real variation (overload
    set bumps + week-rotated drill) lives in block data + `notes`, neither surfaced at week level,
    and `SessionBlocks` doesn't render `notes` either. Fix: a pure tested `weekHeadline(week)` that
    differentiates same-phase weeks + render `notes` in the drill-down.
  - **BC-54 (P2/S) — shared `BlockSummary` component** to kill the three-surface render drift
    (Today shows `notes`, player + program drop it) that _caused_ BC-52. Prevention.
- **Root smell:** a `Block` is rendered three different ways (Today / session player / program
  preview); `notes` shown in one, silently dropped in two. BC-54 consolidates it.
- **Minor nit (not filed):** `UserProfile.sessionsPerWeek` still comments `// 2..4` in
  `src/domain/types.ts:63` — stale since BC-45 made it 1..7. Fold into the next `types.ts` touch.
- **Verified:** `tests/crew/backlog-hygiene.test.ts` green (BC-52…54 declare `Files:`, deps resolve
  to done BC-46/47/48, no dangling deps). **Not pushed** — local backlog/HANDOFF edits only; a
  supervised push/PR is the next step if the human wants it recorded on `main`.

## Current state — 2026-06-13 (BC-51 shipped — PO feedback COMPLETE, last touched by: Claude Opus 4.8)

- **BC-51 DONE (PR #35) — Insights now has a personalised "Coach's read".** Pure
  `summariseInsights(insights, acwr, asOf)` composes 1–4 prioritised supportive-coach sentences:
  **safety leads** (ACWR > 1.5 or recent sharp pain first), then a pyramid read (broad base → ready to
  push; top-heavy → broaden), then a consistency close. Cold start → one honest "log a few sessions"
  line, never NaN/fake-confidence. Renders as a "Coach's read" card above the charts. Deterministic,
  on-device (sibling of the future LLM BC-42). TDD: `insights.test.ts` covers every branch + the
  safety-first ordering + empty state. `pnpm gate` green.
- **🎉 The entire PO hands-on-feedback list is now delivered.** All 8 code PBIs shipped to `main`
  (BC-44 VB/V0 · BC-45 1–7 sessions · BC-46 content model · BC-47 rich session player · BC-48 program
  variation + clickable · BC-49 drills detail · BC-50 prehab detail · BC-51 Insights summary) + BC-19
  absorbed. Each via TDD → green gate → PR → CI → rebase-merge.
- **Open backlog is getting large again** — consider condensing BC-44…BC-51 into the Shipped log next
  grooming pass (keep them as `### … done` headers per the Crew-scheduler rule). Remaining open work is
  unrelated P2/P3 (data-safety BC-31/32/33/34, harness BC-26/35/36/37, charts BC-38, etc.).

## Current state — 2026-06-13 (BC-48 shipped — program variation + clickable program, last touched by: Claude Opus 4.8)

- **BC-48 DONE (PR #34) — the program no longer reads the same every week, and you can click into it.**
  `generateProgram` varies weeks within a phase: a `phaseRunOrdinal` drives progressive overload (each
  later same-phase week adds main volume) and the volume day's technique drill rotates by `weekIndex`
  (`drillForWeek` from `DRILLS` — **absorbs BC-19**, now also marked done). `/program` is clickable:
  week → sessions → a read-only session view with each block's target + collapsible `ExerciseDetail`.
  TDD: `periodization.test.ts` asserts real content variation, progressive overload, and deterministic
  drill rotation. `pnpm gate` green.
- **8 of 8 PO-feedback PBIs that touch code are now shipped (BC-44/45/46/47/48/49/50 + BC-19 absorbed).
  Only BC-51 remains: Insights personalised analyser summary** (deterministic on-device read over the
  existing signals; pairs with BC-38 charts). After BC-51 the PO's entire feedback list is delivered.

## Current state — 2026-06-13 (BC-47 shipped — rich session player, last touched by: Claude Opus 4.8)

- **BC-47 DONE (PR #33) — tapping "Start" is no longer vague.** `Block` gained `content?: ExerciseContent`;
  `periodization`'s `mainContentFor(type)` populates every main block with cited how-to (limit = 3–5
  moves + long rest; 4×4 = 4 boulders × 4 rounds × 4-min rest; volume = 10–20 climbs + 1–2 intentions;
  antagonist circuit). The session player shows a collapsible **"How to do this"** → `ExerciseDetail`
  (image + steps + cues + mistakes) per block. Session-type SVGs added. TDD: `periodization.test.ts`
  asserts every main block carries steps + an image. `pnpm gate` green.
- **7 of 8 PO-feedback PBIs shipped (BC-44/45/46/47/49/50). Remaining: BC-48** (program week variation +
  clickable program drill-down) and **BC-51** (Insights personalised summary).
- **Note (BC-13 dep cycle avoided):** `types.ts` now imports a type from `exerciseContent.ts`, which
  imports nothing — acyclic, depcruise green.

## Current state — 2026-06-13 (BC-50 shipped — prehab/off-wall detail, last touched by: Claude Opus 4.8)

- **BC-50 DONE (PR #32) — prehab/off-wall exercises now have dosage + step-by-step + images.**
  `OffWallExercise extends ExerciseContent`; every exercise carries a concrete `dosage` (sets × reps),
  `steps`, `commonMistakes`, `imageId`. `/exercises` shows dosage in the list and is now list →
  "Instructions" → `ExerciseDetail`. **Additive-only safety contract preserved** (content is text only,
  no path into the load engine; `prescribeOffWall` invariants unchanged + green). TDD:
  `offWallExercises.test.ts` asserts dosage + rich content per exercise. `pnpm gate` green.
- **6 of 8 PO-feedback PBIs shipped (BC-44/45/46/49/50). Remaining: BC-47** (session-block instructions
  — reuse `ExerciseContent`/`ExerciseDetail`), **BC-48** (program week variation + clickable program),
  **BC-51** (Insights personalised summary).
- **Concurrency note:** a parallel CV-research session has a local-only `main` commit (`b728c91` →
  rebased) with the CV feasibility doc + BC-24 spec; it's unpushed and docs-only. I base feature branches
  on `origin/main` to keep PRs clean of it.

## Current state — 2026-06-13 (BC-46 + BC-49 shipped — exercise content model + drills, last touched by: Claude Opus 4.8)

- **BC-46 + BC-49 DONE (PR #30) — the shared exercise content model + the first consumer (drills).**
  A foundation with no consumer is dead code knip rejects, so BC-46 landed _with_ BC-49 (its first user).
  - **BC-46:** pure `src/domain/exerciseContent.ts` (`ExerciseContent` shape:
    steps/cues/commonMistakes/dosage?/imageId?; `imagePathFor` → `public/exercises/<id>.svg` with a
    `_placeholder.svg` fallback — never a broken `<img>`; `hasRichContent`). Presentational
    `src/app/components/ExerciseDetail.tsx` renders it. Assets/convention in `public/exercises/`.
  - **BC-49:** `Drill extends ExerciseContent`; every drill has real `steps`/`commonMistakes`/`imageId`.
    `/drills` is now list → "Instructions" → `ExerciseDetail`. CTA gated on `hasRichContent`.
- **Reuse path for the rest:** **BC-50** (prehab/off-wall) and **BC-47** (session blocks) now just adopt
  the same `ExerciseContent` shape + render `ExerciseDetail` — don't re-implement. Then **BC-48**
  (program week variation + clickable program) and **BC-51** (Insights summary). 4 of 8 PO-feedback PBIs
  shipped (BC-44/45/46/49).
- **Note:** several drill `imageId`s (deadpoint, smear, ecu-pronation, tendon-glide) have no SVG yet and
  fall back to the placeholder by design — add art under `public/exercises/` when available (BC-14-style).

## Current state — 2026-06-13 (BC-45 shipped — 1–7 sessions/week, last touched by: Claude Opus 4.8)

- **BC-45 DONE (PR #29) — sessions/week is now 1–7 with frequency guidance.** `bootstrap` band is
  `MIN_SESSIONS=1`/`MAX_SESSIONS=7`; `sessionPlanFor` returns a safe rotation for any 1–7 (one limit +
  one PE day max; extras are low-intensity volume/technique + antagonist-prehab — additive-safety, never
  more max-effort work). New pure `src/domain/frequencyNotes.ts` (`frequencyGuidance`) gives a per-band
  note; ≥5× carries a load-management caution. Profile offers 1×…7× and renders the note in a `Callout`.
  TDD: new `frequencyNotes.test.ts` + extended `periodization`/`profile` tests. `pnpm gate` green.
- **Two PO-feedback PBIs shipped (BC-44, BC-45). Next: BC-46** (exercise content model — the foundation
  BC-47/49/50 reuse), then BC-47/49/50 → BC-48 → BC-51.

## Current state — 2026-06-13 (BC-44 shipped — VB/V0 grades, last touched by: Claude Opus 4.8)

- **BC-44 DONE (PR #28) — the grade scale now reaches VB/V0**, so the app can finally onboard real
  beginners. New pure `src/domain/grade.ts` is the single source of truth: `VB=-1`, `V0=0`, `MAX_GRADE=17`,
  `formatGrade` (renders "VB" for sub-zero, never "V-1"), `isValidGrade`. Consumers: `bootstrap`
  validation + `periodization`/`session` grade floors read `VB`; `GradePill`, the profile grade selects,
  and the session player render via `formatGrade`. Profile now offers VB…V17.
  - **Safety file `adaptation.ts` touched (protocol followed).** The regression rule's
    `Math.max(1, target-1)` floor was a latent bug once grades went below V1: a V0 climber missing
    targets got floored **up** to V1. Fixed to `Math.max(VB, target-1)` (additive-safe — only lowers) +
    `formatGrade` in the reason strings. **`safety-rule-reviewer`: PASS**; the invariants fuzzer is
    unchanged and green; `pnpm test:safety` 25/25. See LEARNINGS 2026-06-13 (×2: the knip
    duplicate-export gotcha and the regression-floor bug).
  - **TDD throughout:** `tests/domain/grade.test.ts` (new), extended `profile.test.ts` (VB/V0 accepted,
    sub-VB rejected), `periodization.test.ts` (VB floor), `adaptation.test.ts` (V0→VB easing). `pnpm gate`
    green.
- **Next PO-feedback PBIs, in order:** BC-45 (sessions 1–7 — also edits `periodization.ts`/`bootstrap.ts`/
  `profile`, so it follows BC-44 sequentially) → BC-46 (content-model foundation) → BC-47/49/50 → BC-48 →
  BC-51. The autonomous run is working down this list.

## Current state — 2026-06-13 (CV-feasibility research session, last touched by: Claude Opus 4.8)

- **Computer-vision "analyze your climb → technique advice" feature researched for feasibility + as an
  undergrad thesis topic.** Findings doc:
  **`docs/research/2026-06-13-computer-vision-climb-analysis-feasibility.md`** (9 sources cited:
  Belay.ai, ClimbingCoach, Roboflow BoulderVision, Plymouth Student Scientist undergrad paper,
  PMC10574944 six-error iPad system, PMC11881084 survey, The Way Up dataset arXiv 2505.12854).
- **Conclusion — feasible at MVP scope, not as a general "optimal technique" coach.** Markerless pose
  (MediaPipe / YOLOv8-pose / ViTPose) from a phone is solved; the hard parts are **occlusion** (hands
  behind torso — footwork/CoM reliable, fine hand technique not from one camera), **hold-detector
  generalisation** across gyms, and **honest validation of advice quality**. Recommended app shape:
  **Option A — on-device in-browser MediaPipe**, capture glue in `src/app/**`, analysis as a **pure
  `src/domain/technique.ts`** (keypoint arrays → rule-based flags + CoM path; testable to per-file
  coverage with JSON fixtures, no video in CI). Reuse PMC10574944's six geometric beginner-error rules,
  scoped to the occlusion-robust subset (hip-to-wall, weight-shift, both-feet-set, tempo/rest).
- **`BC-24 · CV/ML technique coach` design spec drafted** —
  **`docs/specs/cv-technique-coach-design.md`** (BC-24's design-only deliverable). Scope = MVP **L
  slice** (on-device in-browser MediaPipe + pure `src/domain/technique.ts` → six-error occlusion-robust
  flags + CoM path + angular-velocity move segmentation, visibility-gated); "optimal technique" +
  hold-awareness are the XL tail, explicitly out of scope. Optional LLM narration = BC-42. **Pending PO
  review; still no app code** until a milestone schedules it (PO said focus P1/P2 first). BC-24 backlog
  entry updated to "design spec drafted".
- **Thesis verdict: strong/ideal** — the Plymouth paper proves the scope fits an undergrad; pick ONE
  narrow measurable question (recommended: re-implement the six-error rules on monocular MediaPipe vs
  the iPad+LiDAR original and quantify the accuracy loss). The trap to avoid is promising "optimal
  technique" (unfalsifiable). The thesis evaluation _is_ the feature's otherwise-missing validation.
- **No app code changed — research + design docs only.** `pnpm gate` green. Local edits: new research
  doc, new `docs/specs/cv-technique-coach-design.md`, `docs/BACKLOG.md` (BC-24), this file.

## Current state — 2026-06-13 (PO hands-on-feedback session, last touched by: Claude Opus 4.8)

- **Backlog extended with 8 PBIs (BC-44…BC-51) from real use of the live app**, grounded in new
  research: **`docs/research/2026-06-13-indoor-bouldering-program-best-practices.md`** (cited coaching
  sources — V-scale, periodization/DUP, session protocols). Theme: **content depth & onboarding
  fidelity**. Each was verified a real gap against the code:
  - **BC-44** — extend grade scale to **VB/V0** (today `MIN_GRADE = 1` + `Math.max(1,…)` floors +
    `GradePill` `` `V${n}` `` exclude beginners). New pure `src/domain/grade.ts` (`formatGrade`, `MIN_GRADE=-1`).
  - **BC-45** — **sessions/week 1–7** with frequency guidance/load-notes (today clamped 2..4;
    `sessionPlanFor` only has 2/3/4). New pure `src/domain/frequencyNotes.ts`.
  - **BC-46** — **shared exercise content model** (steps/dosage/images + `ExerciseDetail`) — the
    foundation BC-47/48/49/50 reuse (don't re-implement 4×).
  - **BC-47** — rich session player (detailed todos/instructions/images per block) — closes "tapping
    **Start** is vague": `Block.notes` is one line today.
  - **BC-48** — **week-to-week program variation** (progressive overload + drill/prehab rotation) +
    **clickable program** drill-down. Closes "every week is the same": `generateProgram` emits
    byte-identical blocks per phase week (only `PHASE_VOLUME` scales sets). **Absorbs open BC-19**
    (drill rotation — annotated on BC-19).
  - **BC-49 / BC-50** — drills & prehab/off-wall get step-by-step + common-mistakes + dosage + images +
    detail views (today one-line `description`s, flat lists). Clean disjoint pair after BC-46.
  - **BC-51** — **personalised Insights analyser summary** (deterministic, on-device) — the PO's "graph
    with a personalised analyser summary": **BC-38** = the graph, BC-51 = the plain-language read; the
    deterministic sibling of the future **BC-42** AI review.
- **Verified:** `tests/crew/backlog-hygiene.test.ts` green (all open PBIs declare `Files:`, no dangling
  deps; BC-44…BC-51 deps resolve to BC-04/06/22/30/46). Recommended-order + parallel-pairs guidance
  updated (note: BC-44/45/47/48 all edit `periodization.ts` → run **sequentially**).
- **Not yet pushed.** Local edits only: `docs/BACKLOG.md`, new `docs/research/…best-practices.md`, this
  file. No code changed — backlog grooming. A supervised push/PR is the next step if the human wants it
  recorded on `main`.

## Current state — 2026-06-12 (backlog-grooming session, last touched by: Claude Opus 4.8)

- **Backlog extended + archived.** A brainstorming session added **17 new PBIs (BC-27…BC-43)** across
  four themes — training depth (BC-27 benchmark recalibration, BC-28 readiness score, BC-29 restore
  `injuryHistory[]`, BC-30 pyramid goals), stability/data-safety (BC-31 persistent storage, BC-32 schema
  migration + integrity, BC-33 error boundary, BC-34 backup nudge), infra/quality-bar (BC-35 mutation
  testing on the safety files, BC-36 bundle budget, BC-37 a11y gate), design/UX (BC-38 Insights charts,
  BC-39 install prompt, BC-40 streak) + 3 P3 design-only vision bets (BC-41 health import, BC-42
  AI weekly review, BC-43 shareable progress). Each verified a real gap against the code.
- **Done PBIs condensed to a Shipped log (the "backlog is getting big" fix).** The 17 shipped PBIs
  (BC-01…BC-13, BC-15, BC-17, BC-22, BC-23) lost their verbose bodies; they now live as one-line
  done-status headers in the new **Shipped log** at the bottom of `docs/BACKLOG.md` (kept as `###`
  headers, not plain bullets — see below). Git history + `docs/LEARNINGS.md` retain the detail, so
  the active backlog is now just the **open** P2/P3 items.
  - **Why they stay `###` headers (gate-blind trap, now Tier-1 guarded):** the Crew scheduler gates
    assignment on `dependsOn.every(d => doneIds.has(d))` and builds `doneIds` only from PBIs that
    `parseBacklog` returns as `done` (`scripts/crew/lib/schedule.mjs`). Collapsing a shipped PBI to a
    plain bullet would drop it from `doneIds` → every open PBI depending on it (BC-27→BC-06,
    BC-31/33/34/43→BC-10, BC-40→BC-03, BC-42→BC-07) becomes **un-assignable forever**. New guard:
    `tests/crew/backlog-hygiene.test.ts` now also asserts **no dangling dependencies** (every
    `dependsOn` ID resolves to a parsed PBI). Verified: 43 PBIs (26 open / 17 done), 0 fileless-open,
    0 dangling deps.
- **Not yet pushed.** Changes are local (BACKLOG.md + the hygiene-test guard + this file). A supervised
  push/PR to `main` (protected) is the next step if the human wants it live.

## Current state — 2026-06-12 (deploy session, last touched by: Claude Opus 4.8)

- **BC-15 DONE — the app is LIVE in production.** First production deploy to Vercel:
  **https://boulder-coach-gamma.vercel.app** (verified: `/`, `/manifest.webmanifest`, `/sw.js` all
  HTTP 200; deployment `READY`, target production). Project `erdafas-projects/boulder-coach`, connected
  to the GitHub repo. **Zero-config** — Vercel auto-detects Next.js + pnpm; no env vars (client-side
  Dexie), no `vercel.json`/`vercel.ts`. Deploy flow documented in `README.md` → "Live deployment".
  Service-worker update path: SW is network-first for navigations so new deploys reach users
  immediately; bump `CACHE` in `public/sw.js` only to force-purge the shell.
  - **Deploy gotcha (LEARNINGS 2026-06-12):** the Vercel **MCP** OAuth token authorizes read/manage
    tools only — `deploy_to_vercel` is advisory and the MCP cannot upload a local build. Publishing a
    local tree needs the **CLI** (`vercel login` is a separate, interactive token) or a git push to the
    connected project. CLI installed on-demand via `pnpm dlx vercel@latest` (no global bin configured).
- **Copilot-merge review (this session) — one real bug found and fixed.** While the primary agent was
  rate-limited, GitHub Copilot merged PR #20 (BC-11 nav e2e). A two-agent parallel review (isolated
  worktrees) of that merge found **`playwright` (the full browser package) was added to production
  `dependencies`** — e2e tooling must never ship to prod, and it's redundant (every spec imports
  `@playwright/test`, already a devDep). Removed it → commit **`badc81f`**
  `fix(deps): remove redundant playwright from production dependencies`. The gate did NOT catch this
  (knip's Playwright plugin saw the dep as "used"), so it's a **new gate-blind risk** — see the
  open-threads list. `e2e/nav.spec.ts` itself was verified correct against the real `BottomNav.tsx`
  (passes vs the prod build). Local `pnpm gate` green after the fix.
- **BC-23 follow-up — prod-only brand-font regression fixed and committed.** After
  BC-23 merged, the app looked "bland / just HTML" **in production only**: the three brand webfonts
  weren't loading, so prod fell back to system fonts (colors were fine). Root cause + fix in
  **LEARNINGS 2026-06-12** — the fonts now load via a `<link>` in `layout.tsx` (was a CSS `@import`
  the prod optimizer dropped), Geist was removed, and a Tier-1 guard blocks the pattern. The fix
  was committed (ec49628), the branch `agents/install-chromium-for-playwright` was pushed, and a PR
  was opened: https://github.com/dafandikri/boulder-coach/pull/20. The new e2e nav smoke test
  `e2e/nav.spec.ts` was added and passes locally (Playwright). Local `pnpm gate` is green; CI's
  required "quality" check is running on the PR.
- **BC-23 — Boulder Coach Design System adopted (full frontend reskin). Merged (PRs #17/#18).**
  The plain Tailwind/Geist grayscale UI is now the bright climbing-gym brand: warm chalk surfaces,
  basalt ink, the climbing-hold rainbow, coral brand, chunky Baloo 2 / Nunito / Space Mono type, pebble
  radii, and the signature "sticker pop" on buttons/feature cards. **Also closes BC-11** (bottom nav).
  - **Tokens + fonts:** all design tokens are CSS custom properties in `src/app/globals.css`. The 3
    webfonts (Baloo 2 / Nunito / Space Mono) load via a real `<link rel="stylesheet">` in `layout.tsx`
    (React 19 hoists it to `<head>`) — **NOT** a CSS `@import`, and **NOT** `next/font/google`. Why:
    `next/font/google` fetches at build time and flaked the offline `build` gate (LEARNINGS 2026-06-10);
    a CSS `@import` is dropped by the production optimizer once it's bundled behind any `@font-face`, so
    prod silently fell back to system fonts (the "bland in prod" bug — **LEARNINGS 2026-06-12**). A
    `<link>` is a runtime browser fetch (deterministic build) that CSS bundling can't touch. The unused
    Geist `next/font` was removed (it was the `@font-face` jammed ahead of the import). Guard:
    `tests/build/deterministic-fonts.test.ts` (Tier-1) now bans remote `@import url(http…)` in src CSS
    and requires the font `<link>` in `layout.tsx`.
  - **14 TS primitives** under `src/app/components/` (presentational only, no `any`, gate-blind by
    design — they're outside the coverage `include` globs, so they carry no logic): `Button`, `Card`,
    `SessionCard`, `Badge`, `GradePill`, `Chip`, `Callout`, `ProgressBar`, `StatCard`, `Icon`,
    `HoldMark`, `Spinner`, `BackLink`, `BottomNav`. Icons are tree-shakeable named `lucide-react`
    imports behind `Icon.tsx` (`IconName` union). Hold pebbles are `public/holds/hold-*.svg` rendered
    as CSS backgrounds (no `<img>`, no layout shift).
  - **App shell:** `layout.tsx` wraps children in a centred `max-w-[28rem]` column with `pb-24` and a
    fixed `<BottomNav />` (Today / Insights / Program / Drills / You, active-route aware, safe-area
    inset). All 9 pages dropped ad-hoc "← Today" anchors for the shared `BackLink`/bottom nav.
  - **All 9 screens restyled** (Today, Check-in, Session, Insights, Program, Drills, Profile, Exercises,
    History) — **logic untouched** (every hook, `cycleSeverity`, rest-timer maths, `prescribeOffWall`,
    `validateProfile`, backup I/O preserved verbatim; only JSX/styles changed).
  - `public/logo-mark.svg` (brand mark) renders on the first-run welcome header (as a CSS-background
    span, like `HoldMark` — no `<img>`); hold pebbles decorate the other headers/empty states.
  - **One deliberate YAGNI deviation from BC-23's criteria** (documented in the PBI): `Eyebrow` is the
    `.bc-eyebrow` utility class, not a component — pure presentation used inline on every screen.
- **Next actions:** (1) Wait for the PR's required "quality" CI check to complete; once it is green,
  merge the PR (it will be merged automatically on a green `quality` check). (2) Optional follow-up
  still open from BC-22: Today has no link to `/exercises` (direct-URL only) — the new bottom nav
  does **not** cover it either, so fold an entry point in. (3) **BC-25 (dark mode)** is now unblocked
  — the light token layer it extends is in place.
- **Verify before finishing:** `pnpm gate` is green locally; CI will run the same gate on the PR. If
  anything in CI fails, append a LEARNINGS entry and update HANDOFF.md in the same commit.

## Current state — 2026-06-11 (last touched by: Claude Opus 4.8)

- **Third parallel batch shipped 3 P2 PBIs — first P2 wins are in.** A supervised session dispatched
  three file-disjoint worker agents (Agent-tool worktree isolation), then ran the full
  push→PR→CI→review→merge cycle. All merged to `main` (rebase→green-`quality`→rebase-merge):
  - **BC-13** (`d418717`, PR #14) — pain/soreness severity now cycles none→1→2→3→none (was a 0↔2
    toggle, so 1 and 3 were unreachable). Cycle logic lives in covered `src/app/lib/checkinForm.ts`
    (`cycleSeverity`), not the gate-blind page; Insights log already renders `severity` so 1/3 now
    surface automatically.
  - **BC-17** (`c85d5a6`, PR #13) — CI caches Playwright browsers (`actions/cache` on
    `~/.cache/ms-playwright`, keyed on `pnpm-lock.yaml` hash). Cache-hit skips the ~100 MB download but
    still runs `playwright install-deps` (OS deps aren't cacheable). The hit path proves out on the NEXT
    CI run (this batch's runs primed the cache).
  - **BC-22** (`2687031`, PR #15) — off-wall antagonist/core/mobility prescription. Pure
    `src/domain/offWallExercises.ts` (`prescribeOffWall(type, phase?)`, exhaustive `SessionType` switch,
    **additive-only safety contract — never raises climbing load**) + render-only `/exercises` route.
    _Follow-up (open):_ no link to `/exercises` from Today yet — reachable by direct URL only; fold a
    card/link into BC-11 (bottom nav) or a small UI pass.
- **Tier-1 fix (this batch's close-out): ESLint now ignores the agent worktrees.** Worktree pollution
  caused a _false_ local pre-push gate failure for the second time (batch 2 it was `prettier --check .`,
  batch 3 it was `eslint .` linting sibling agent checkouts under `.claude/worktrees/`). Crossing the
  ≥2× line, the lesson moved out of prose into `eslint.config.mjs` `globalIgnores` (the `worktrees`
  glob). Parallel-agent supervisors: still remove worktrees before a deliberate clean local gate
  (`git worktree remove --force … && git worktree prune`), but a push while a sibling agent is still
  in-flight no longer false-fails. CI is unaffected (clean checkout, no worktrees).
- **Second parallel batch shipped 3 PBIs — ALL P1 now done.** A supervised session dispatched three
  isolated worker agents (Agent-tool worktree isolation) on a file-disjoint set, then ran the full
  push→PR→CI→review→merge cycle. All merged to `main` via rebase→green-`quality`→rebase-merge:
  - **BC-07** (`f03e5ba`, PR #9) — persisted "why" log + neutral-check-in flag. New `adaptationLog`
    Dexie store (`.version(2)`), idempotent per local date; Today shows the neutral banner, Insights
    renders the decision log newest-first. Logic in covered `bootstrap.ts`, pages only render.
  - **BC-12** (`245764e`, PR #10) — honest error/empty states (session retry, program→/profile,
    check-in prefill-not-overwrite). Decisions live in covered `loadState.ts`/`checkinForm.ts`.
  - **BC-10** (`ce98d53`, PR #11) — versioned JSON export/import (`BackupV1`, validate-before-wipe).
  - **Supervisor reconciled an integration defect the isolated workers couldn't see:** BC-10's worker
    added `clearAll()` to the repo seam (straying from its declared `Files:`), overlapping BC-07's
    seam edits. Merges were ordered so the overlap rebased sequentially; during BC-10's rebase the
    supervisor made `clearAll()` also wipe `adaptationLog`, added `adaptationLog` to `BackupV1`
    export/import (past decisions aren't regenerable), and fixed a latent BC-02 UTC bug in
    `backupFilename` (now uses `localDateIso`). See `docs/LEARNINGS.md` (2026-06-11).
- **Ledger retrieval added — `pnpm learnings <file-or-keyword>` ("look up, don't load").** The ledger
  is long-term memory; a fresh agent now pulls ONLY the entries relevant to what it's touching instead
  of reading all 350+ lines. `pnpm learnings` (no arg) prints the index; a query prints the full block
  of each matching entry (case-insensitive, header + body). Plain awk/grep — deliberately NOT a vector
  DB (YAGNI at this scale; the gate stays plain shell+git). Tier-1: `tests/harness/learnings.test.ts`
  pins the retrieval contract. Docs reframed from "grep the ledger" → the lookup command across
  `AGENTS.md`, `CLAUDE.md`, `README.md`, `onboard.sh`, and this file. **Merged to `main` via PR #6**
  (`8300cf9`, CI `quality` green).
- **Crew's first live parallel run shipped 3 PBIs.** `pnpm crew start` (maxWorkers 3) ran BC-06, BC-08,
  BC-09 in file-disjoint worktrees; all three merged to `main` via the real rebase→gate→ff-merge path:
  - **BC-08** (`e311380`) — long-layoff detection + deloaded re-entry (`detectLayoff`/`reEntryReRamp`).
  - **BC-09** (`4cfc447`) — per-block rest timer (`restTimer.ts` pure logic + `RestControl` wiring).
  - **BC-06** (`bee8515`) — onboarding + editable profile (`validateProfile`/`applyProfile`); home now
    routes first-run visitors to `/profile` instead of silently seeding `DEFAULT_PROFILE`.
- **Live run found + fixed a gate-blind adapter bug** (`b180e6c`): `--disallowed-tools` is variadic and
  swallowed the worker prompt as deny-rules → workers got an EMPTY charge. Fix: feed the charge on stdin
  (`<<<"$charge"`). Promoted to Tier-1: `tests/crew/adapter.test.ts` pins stdin delivery + the security
  contract. `maxWorkers` default is now **3** (`cc45574`). See `docs/LEARNINGS.md` (2026-06-11).
- **App:** Plans 1–3 + **all five P0 backlog items (BC-01…BC-05)** + the font-flake build fix (`fd0b4be`)
  are committed on `main`. PWA: Today, check-in, session player, history, insights, program, drills, SW.
- **Crew multi-agent orchestrator — MERGED to `main`** (PRs #1–#4): a git-native, tool-neutral system
  to run agents in parallel worktrees on file-disjoint PBIs, with reviewer-gated tiered auto-merge and
  human override. `pnpm crew start|status|approve|reject|pause|resume`. See `docs/crew/README.md` +
  the spec/plan under `docs/superpowers/`. Includes the 7-finding `/code-review high` hardening pass.
- **Permissions (final, secure):** Claude worker adapter uses `acceptEdits` + a command **allowlist**
  in `.claude/settings.json` (a security review flagged the first cut's `bypassPermissions` — fixed).
  **Scoped push:** `allow` grants push/`gh` to the _supervised_ session; the worker adapter passes
  `--disallowed-tools "Bash(git push:*)" …` so autonomous **workers cannot push**. Recommend enabling
  **GitHub branch protection on `main`**. `.crew/config.json` now defaults to `maxWorkers: 3` (the
  adapter stdin-fix made parallel viable).
- **Backlog groomed (PR #3):** added BC-22 (off-wall exercises, P2), BC-23 (visual redesign + dark
  mode + branding, P2), BC-24 (CV technique coach — future, design-only, P3). "Timer" = existing BC-09.
- **Domain (pure):** loadMetrics, warmup, periodization, programClock, schedule, adaptation (safety),
  sessionLog, insights, drills. Gate green; adaptation/loadMetrics + schedule all 100% branch.

## Pending (uncommitted) — none

Everything is on `main` (`pnpm gate` green). BC-07/BC-12/BC-10 shipped via PRs #9/#10/#11; all
feature branches merged + deleted; no worktrees but the primary. **Note:** a PR #2 merge race once
dropped commits — when merging, verify the PR head SHA equals local HEAD. **Worktree-isolation
gotcha (this batch):** Agent-tool worktrees live under `.claude/worktrees/` (NOT gitignored), so
`pnpm gate`/pre-push scans them and fails on `main` while they exist — `git worktree remove --force`
them before gating/pushing. Not yet a Tier-1 check (candidate: gitignore `.claude/worktrees/`).

## Code-review hardening (7 findings fixed, each tested)

A `/code-review high` of the branch found 7 issues, all in the I/O wiring (the faked-in-tests layer);
all fixed: (1) reviewer is now fail-safe — agent failure → FLAG → human queue, never a throw that
strands a claim; (2) reviewer + manager are tool-neutral via injected `config.aiAgent` (no hardcoded
`claude`); (3) `landBranch` never throws past its re-queue guard; (4) it refuses to merge unless the
primary tree is on `main`; (5) a PBI with unparsed priority sorts last, not ahead of P0; (6) the
conductor owns "done" via a `.crew/completed/` ledger (no redo loop if a worker forgets to mark
BACKLOG); (7) a split that can't fit free slots falls back to the whole PBI (no stranded sub-task).

## Crew — what shipped (branch `feat/crew-orchestration`)

- **Pure core (TDD, `// @ts-check`):** `scripts/crew/lib/{glob,backlog,schedule,risk,lease,claims,
manager,split,route}.mjs` — backlog parsing, dependency-gated **file-disjoint** scheduling (the conflict
  lock), safe split-planning, finish-routing, tiered-merge risk classifier, lease, atomic claims.
- **Conductor (dependency-injected, testable):** `conduct.mjs` exports `createConductor(deps)`; the full
  assign→launch→finish→(merge|queue) state machine is exercised in `tests/crew/conductor.test.ts` with
  fakes (no live agent/git). `merge.mjs`, `crew.mjs` (CLI w/ `run()` + main-guard), `lib/{git,launch,
review}.mjs`, adapters, prompts, `.crew/config.json`.
- **All wiring is type-checked:** every `scripts/crew/**/*.mjs` carries `// @ts-check` and is in
  `tsconfig` `include`, so tsc + type-coverage cover it (was a gate-blind gap).
- **Backlog is load-bearing:** every open PBI has a `Files:` set; `tests/crew/backlog-hygiene.test.ts`
  fails the gate otherwise (the lock depends on it).

## Limitations from the first pass — now RESOLVED

1. **Wiring `.mjs` were outside tsc/type-coverage** → added `// @ts-check` to all of them + put
   `scripts/crew/**/*.mjs` in `tsconfig` `include`; tsc clean, type-coverage 99.82%.
2. **Orchestration was unexercised** → refactored the conductor to dependency injection and added
   `tests/crew/conductor.test.ts` (assignment, auto-merge, review-routing, flag, blocked-merge-requeue,
   split, lease reclaim) + `tests/crew/cli.test.ts`. A blocked post-rebase merge now re-queues for a
   human instead of stranding the claim.
3. **Manager split was inert** → implemented `lib/split.mjs` `planAssignments()` (validates sub-tasks
   are within the PBI lock, mutually disjoint, and a complete cover; else falls back to the whole PBI),
   wired into the conductor and tested.

## Remaining honest caveats (genuinely out of CI scope)

- A true end-to-end run with **live agent CLIs + real worktrees** is no longer purely hypothetical — it
  ran (3 PBIs merged) — but it's still not in CI (you can't cheaply spawn Claude/Codex in the gate). The
  orchestration logic is fully faked-tested; the shell adapter is now Tier-1 guarded; real git/merge
  calls are still only exercised by running `pnpm crew start`.
- **`crew approve` releases the claim but does not write the `.crew/completed/` ledger** (only the
  conductor's auto-merge path does). After a batch of manual approvals, mark the PBIs `done` in
  `docs/BACKLOG.md` (status is what gates re-assignment) — done for BC-06/08/09 this run.
- **A killed worker leaves an empty-branch `review-queue/<PBI>.md`** (its `onExit` routes a 0-commit
  branch). After an interrupted run, clear stale `.crew/review-queue/*` before relying on the queue.

## Next actions (prioritized)

> **All P0 and all P1 PBIs are now done.** The remaining open work is P2 (polish/infra) + P3
> (design-only future bets). Next batches are P2.

1. **Remaining P2 is mostly page-touching or solo work — fewer clean parallel sets left.** Done this
   round: BC-12, BC-13, BC-17, BC-22. Still open: **BC-11** (bottom-tab nav — `layout.tsx` + every
   page; run **solo**, it conflicts with any page-touching PBI), **BC-16** (installability/offline e2e
   in CI — `e2e/` + `ci.yml`; promotes the SW gate-blind risk to Tier-1), **BC-23** (visual redesign +
   dark mode, size **L** — solo it). A plausible disjoint pair is **BC-16** (CI/e2e) + **BC-23**
   (`globals.css`/`layout.tsx`/`theme.ts`) only if BC-23 doesn't also rework the nav BC-11 owns —
   sequence BC-11 → BC-23 to avoid the `layout.tsx` overlap. Whether `pnpm crew start` or Agent-tool
   isolation: verify the real `git diff --name-only` of each branch against `main` before merging — an
   agent can stray from its declared `Files:` (BC-10 did).
2. **Do NOT churn into deferred/unsuitable PBIs.** `BC-14` (icons) needs real art, `BC-15` (Vercel
   deploy) needs secrets/human, `BC-24` (CV coach) is explicitly _future, do not start_. `BC-18`/`BC-24`
   are design-only. Bound any autonomous run so it doesn't pick these.
3. **Small UX follow-up:** `/exercises` (BC-22) has no entry point from Today yet — reachable by direct
   URL only. Fold a card/link into BC-11 (bottom nav) or a tiny UI pass.
4. **Worktree hygiene:** ESLint now ignores `.claude/worktrees/**` (batch-3 close-out), so a push while
   a sibling agent is still working no longer false-fails the local pre-push gate. Still **remove
   worktrees before a deliberate clean local gate run** — `git worktree remove --force` every
   `.claude/worktrees/agent-*`, `git worktree prune`, and delete orphan `worktree-agent-*` branches —
   for an accurate full-tree result. CI is unaffected either way (clean checkout, no worktrees).

## Open threads / known gate-blind risks

> Gate-blind = a real defect a green `pnpm gate` will NOT catch. These need a human/second-model eye.

- **Session player UI is gate-blind** — React components have no RTL/jsdom harness here, so the
  capture/checklist UI is only indirectly tested (via `app/lib` helpers + the integration test).
  Real tap-through is unverified until a Playwright flow exists (relates to BC-16). Mitigation in
  place: `skills/universal-quality-bar.md` mandates logic live in covered `app/lib`, not components.
- **Safety review is now executable** (was Tier-2 prose) — `adaptation.invariants.test.ts` +
  `check-safety-change.sh` enforce the rule table for any tool. The Claude `safety-rule-reviewer` is
  now an optional extra eye, not the only guard.
- **Service-worker runtime behavior** — strategy is guarded by a string test, but real offline/update
  behavior is only verifiable in a browser. Bump `CACHE` in `public/sw.js` on any shell-breaking
  release. (Tier-1 promotion tracked as BC-16.)
- **Manifest icon _quality_** — presence is enforced; the actual art is not (BC-14).
- **e2e/test tooling can hide in production `dependencies`** — knip's Playwright plugin counts
  `playwright` as "used" wherever it sits, so the gate did NOT flag Copilot putting it in prod `deps`
  (fixed in `b6c4f5c`). The gate verifies a dep is _used_, not that it's in the _right_ section. No
  check enforces "dev-only tooling stays in `devDependencies`" yet. **Tier-1 promotion tracked as
  BC-26** (a Vitest test asserting known dev tools are absent from `dependencies`). Until it lands,
  eyeball new entries to `dependencies` in any review.
- **Cross-tool doc drift** — adding routes/modules without updating `README`/`AGENTS.md`. Mitigated by
  the Definition of Done, not yet by a check.

## Hard-won invariants (distilled — full reasons in `docs/LEARNINGS.md`)

- `src/domain/**` is PURE — no I/O, no `Date.now()` inside (pass `asOf`). Enforced by dependency-cruiser.
- UI event handlers that call `setState` must use **block-body arrows** (`() => { setX(); }`) — strict
  ESLint flags the void-returning shorthand.
- e2e runs against the **production build** (`pnpm build && pnpm start`), never `next dev` (Turbopack
  on-demand-compile races).
- Never commit `test-results/` or `.next/` — they're ignored; an `.last-run.json` once broke the gate.
- A green gate is **necessary, not sufficient**: PWA assets, manifests, and docs are gate-blind.
