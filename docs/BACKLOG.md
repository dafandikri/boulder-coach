# Product Backlog — Boulder Coach

**Owner:** dafandikri (product) · maintained by whoever touches it last
**Status:** living document — re-prioritized whenever a PBI ships
**Audience:** humans AND agents of any tool/model. If you can read this, you can pick up a PBI.

This is the single prioritized list of what to build next. It came from a product-owner audit
(2026-06-10) of the shipped app against the design spec
([`specs/2026-06-09-bouldering-coach-app-design.md`](specs/2026-06-09-bouldering-coach-app-design.md)).
Every claim below was verified by reading the code, not assumed.

## How to pick up a PBI (any agent, any tool, or by hand)

1. Run `pnpm onboard`. Read `AGENTS.md` and `docs/HANDOFF.md` first — they are the contract.
2. Take the **topmost PBI whose dependencies are done**. Don't cherry-pick a P2 while a P0 is open
   unless the human says so.
3. Grep `docs/LEARNINGS.md` for every file the PBI touches. Read the matching `skills/` doc.
4. Size M/L → write a plan in `docs/plans/` first (spec → plan → execute). Size S → TDD straight in.
5. TDD is mandatory. Safety files (`adaptation.ts`, `loadMetrics.ts`) additionally need the
   safety-critical-change skill + safety-rule-reviewer approval + 100% branch coverage.
6. `pnpm gate` green → update the PBI status here (same commit) → update `docs/HANDOFF.md` last.

**PBI lifecycle:** `open` → `in-progress (who/when)` → `done (commit)`. Update the status field
in place; never delete a shipped PBI — move it to the Shipped log at the bottom.

**Priorities:** P0 = the product's core promise is broken. P1 = spec'd v1 behavior still missing.
P2 = polish/infra that compounds. P3 = future bets, design-first.
**Complexity:** S/M/L/XL (never time estimates).

---

## P0 — The product promise is broken (all ship with a green gate today)

> The v1 promise: "tells you exactly what to do today, adapts to performance AND feel, keeps you
> out of injury." Safety adaptation works and is well-tested. The _program_ and _progression_
> halves are broken in the five ways below. A green gate catches none of them — they are
> product-correctness defects, which is exactly what this backlog exists to track.

### BC-01 · Program week never advances — `done (9f009bd, 2026-06-10)`

- **Type:** bug · **Priority:** P0 · **Complexity:** M · **Depends on:** —
- **Problem:** `generateProgram` sets `currentWeekIndex: 0` (`src/domain/periodization.ts:145`)
  and **nothing anywhere ever advances it**. The climber stays in week 0's "hard" phase forever:
  scheduled deload weeks never arrive, the peak week never arrives, the 6-week mesocycle is
  decorative. Verified: only reads at `src/app/lib/bootstrap.ts:55` and `src/app/program/page.tsx:36`.
- **Value:** the entire periodization feature starts existing.
- **Acceptance criteria:**
  - A pure domain function derives the current week from `program.startDate` + `asOf` (no
    `Date.now()` inside — pass `asOf`, per domain purity invariant).
  - Week 2 (index 2) is a deload and a date 15 days after start lands in it (test).
  - Past week 5: program is complete → either auto-generate the next mesocycle from the (possibly
    updated) profile, or surface a "cycle complete — start next?" state on Today. Pick one,
    document it in the spec.
  - `bootstrap.getTodaySession` and `/program` both reflect the derived week.
- **Files:** `src/domain/periodization.ts` (or a new pure `programClock.ts`), `src/app/lib/bootstrap.ts`, `src/app/program/page.tsx`, tests.

### BC-02 · Dates are keyed to UTC, not the user's timezone — `done (9f009bd, 2026-06-10)`

- **Type:** bug · **Priority:** P0 · **Complexity:** S · **Depends on:** —
- **Problem:** every date stamp is `new Date().toISOString().slice(0, 10)` (bootstrap, check-in
  page, session page). That's the **UTC** date. The user is in Indonesia (UTC+7): from midnight to
  07:00 WIB the app files check-ins and logs under _yesterday_, and `getTodaySession` then can't
  find today's check-in — a morning check-in is silently ignored by the adaptation engine.
- **Value:** check-ins actually affect the session they were filed for; history dates match reality.
- **Acceptance criteria:**
  - One shared `localDateIso(d: Date): string` helper (local-timezone YYYY-MM-DD) replaces every
    `toISOString().slice(0, 10)` call site in `src/app/**`.
  - Test: a Date at 02:00 UTC+7 (19:00 UTC previous day) maps to the _local_ calendar date.
  - Load-metrics windows (`loadMetrics.ts` date math) reviewed for the same assumption — if it
    needs changes it's a safety file (reviewer + 100% branch).
- **Files:** `src/app/lib/bootstrap.ts`, `src/app/checkin/page.tsx`, `src/app/session/page.tsx`, possibly `src/domain/loadMetrics.ts` (safety).
- **loadMetrics review (BC-02):** left unchanged. Its windows are a coarse 7/28-day floor over
  `daysBetween(asOf, dateIso)`; a sub-day TZ skew only matters at an exact window boundary. The one
  place a same-day local date could be dropped is the `age < 0` guard in the early-WIB-morning hour,
  but the engine computes the session _before_ that day's log exists, so the adaptation path is
  unaffected. Changing it would be unnecessary safety-file churn (YAGNI). Shared helper lives in
  `src/app/lib/date.ts` (app layer — keeps `src/domain` pure of locale/timezone concerns).

### BC-03 · Rest days don't exist; `availableWeekdays` is ignored — `done (9f009bd, 2026-06-10) — schedule.ts hardened post-commit (awaiting commit)`

- **Type:** bug · **Priority:** P0 · **Complexity:** M · **Depends on:** BC-02 (date helper)
- **Problem:** `pickPlannedSession` is `asOf.getDay() % sessions.length`
  (`src/app/lib/bootstrap.ts:32`) — every day of the week returns a training session. The spec
  promises "Today — hero card: today's session **(or recovery if rest day)**" and the profile's
  `availableWeekdays: [1,3,5]` is dead data. A 3-day program currently prescribes climbing 7 days
  a week, which is an injury-risk own goal in an injury-prevention app.
- **Value:** the program respects the climber's schedule; rest becomes a first-class prescription.
- **Acceptance criteria:**
  - Training sessions map to the profile's `availableWeekdays`; all other days produce an explicit
    rest/recovery result (type `'rest'` already exists in `SessionType`).
  - Today screen renders a recovery card (not an empty/blank state) on rest days.
  - Missed session (training day passed, no log): no blind shifting — the next training day picks
    up the rotation; ACWR handles the load drop naturally (spec "Edge cases").
  - Integration test drives a full week through `getTodaySession` and asserts the rest/training
    pattern matches `availableWeekdays`.
- **Files:** `src/app/lib/bootstrap.ts` (or promote scheduling into `src/domain/`), `src/app/page.tsx`, tests.

### BC-04 · Session player captures no climbing data; warm-up auto-completes — `done (9f009bd, 2026-06-10) — grade capture rewritten to a tally model post-commit (awaiting commit)`

> **Post-commit quality fix (Claude Opus 4.8, 2026-06-10):** the first-pass `bumpGrade` was buggy
> — the `−` button _appended_ a decremented grade instead of decrementing a count, so the grade
> arrays could only ever grow, and the tested `expandTally` helper was dead (used only by its test).
> Rewrote the capture as a per-grade `{grade: count}` tally that uses `expandTally` on save, so `−`
> truly decrements. Added the missing end-to-end integration test
> (`tests/domain/sessionCapture.test.ts`): tally → `expandTally` → `createSessionLog` → repo →
> Insights pyramid, via fake-indexeddb (the AC's required test, previously absent).

- **Type:** bug/feature · **Priority:** P0 · **Complexity:** M · **Depends on:** —
- **Problem:** the session player (`src/app/session/page.tsx`) only collects per-block RPE.
  `gradesAttempted`/`gradesSent` are always `[]` and `warmupCompleted` is hardcoded `true`. Three
  downstream features are starved: the Insights grade pyramid is permanently empty, performance
  progression (BC-05) has no input, and the spec's "non-skippable warm-up" has zero enforcement.
- **Value:** the app starts learning from actual climbing, not just perceived effort.
- **Acceptance criteria:**
  - Main blocks get a minimal attempted/sent grade tally (e.g. V-grade steppers — gym-floor
    friendly, thumb-sized).
  - Warm-up blocks render as a checklist; `warmupCompleted` reflects reality; when
    `warmupMandatory` is true, "Finish & log" is blocked until warm-up items are checked.
  - Sets-completed is editable (currently silently assumes plan was hit).
  - A logged session with sends shows up in the Insights grade pyramid (integration test via
    fake-indexeddb).
- **Files:** `src/app/session/page.tsx`, `src/domain/sessionLog.ts`, tests.

### BC-05 · Progression/regression rules (spec rules 6–7) were never implemented — `done (9f009bd, 2026-06-10) — safety-rule-reviewer: PASS (post-commit)`

- **Type:** feature · **Priority:** P0 · **Complexity:** M · **Depends on:** BC-04 (real data; testable earlier with synthetic logs)
- **Problem:** `adapt()` takes `_recentLogs` and ignores it (`src/domain/adaptation.ts:55`). Spec
  rules 6 ("crushing targets → +grade/+volume") and 7 ("missing targets repeatedly → slight
  regress") don't exist. The app deloads you but never progresses you — the anti-plateau promise,
  the user's #1 stated problem, is unaddressed.
- **Value:** the adaptive loop closes; plateau-breaking becomes real.
- **Constraints:** `adaptation.ts` is a **safety file** — safety-critical-change skill,
  safety-rule-reviewer approval, 100% branch coverage, rules stay in priority order (safety rules
  1–5 must always win over progression).
- **Acceptance criteria:**
  - Rule 6: recent logs show targets hit at low RPE (define "crushing" concretely, e.g. last 2
    comparable sessions sent ≥ target grade with block RPE ≤ target−1) → bump `targetGrade` or
    sets, with a human-readable reason.
  - Rule 7: repeated target misses → reduce target one notch, with reason.
  - Neither rule fires when any of rules 1–5 fired (explicit precedence tests).
  - Spec table in `docs/specs/…app-design.md` stays the canonical source; update it if thresholds
    are refined.
- **Files:** `src/domain/adaptation.ts` (safety), `tests/domain/adaptation.test.ts`.

> **Post-commit safety review (Claude Opus 4.8, 2026-06-10):** the safety-file protocol requires
> `safety-rule-reviewer` approval before committing `adaptation.ts`; the original commit skipped it.
> Ran the review retroactively — **PASS**. Precedence is airtight (the `if (changes.length === 0)`
> guard holds even though rules 4–5 push changes without early-returning); progression (the only
> load-increasing direction) cannot fire on absent grade data; regression-on-missing-data fails
> safe (eases the grade); grade bounds V1–V17 sane; function stays pure; adaptation.ts genuinely at
> 100% branch. **Going forward, run the reviewer BEFORE committing any `adaptation.ts` change.**

---

## P1 — Spec'd v1 behavior still missing

### BC-06 · Onboarding & profile screen (the profile is hardcoded) — `done (15c1e10, 2026-06-11)`

- **Type:** feature · **Priority:** P1 · **Complexity:** M · **Depends on:** —
- **Problem:** `DEFAULT_PROFILE` (V5, 3×/week, Mon/Wed/Fri) is silently written on first load
  (`src/app/lib/bootstrap.ts:7`). There is no UI to set or edit grade, goal, frequency, or
  weekdays — the "adapts to the individual" pitch starts from someone else's defaults.
- **Acceptance criteria:** first-run flow (or `/profile` page) sets all `UserProfile` fields;
  editing later offers program regeneration with a confirmation (warn it replaces the current
  cycle); Today reflects the new program immediately. e2e covers first-run.
- **Files:** new `src/app/profile/page.tsx`, `src/app/lib/bootstrap.ts`, `src/app/page.tsx`.

### BC-07 · Surface the "why": neutral-check-in flag + persisted adaptation log — `done (15c1e10, 2026-06-11)`

- **Type:** feature · **Priority:** P1 · **Complexity:** M · **Depends on:** —
- **Problem:** two spec promises: (a) "Skipped check-in → assume neutral, **flag the assumption**"
  — the engine assumes neutral but tells no one; (b) Insights screen lists "the 'why' log" —
  adaptation `changes[]` are computed per render and never persisted, so there is no history of
  what the engine decided and why. Trust in an auto-adjusting coach comes from the paper trail.
- **Acceptance criteria:** Today shows "No check-in today — assuming you feel normal. Check in →"
  when neutral was assumed; each day's `AdaptationChange[]` (+ the assumption flag) is persisted
  via `IClimbRepo`; Insights renders the decision log newest-first.
- **Files:** `src/app/lib/bootstrap.ts`, `src/data/IClimbRepo.ts` + `dexieRepo.ts` (new store), `src/app/page.tsx`, `src/app/insights/page.tsx`.

### BC-08 · Long-layoff detection and re-ramp — `done (15c1e10, 2026-06-11)`

- **Type:** feature · **Priority:** P1 · **Complexity:** M · **Depends on:** BC-01
- **Problem:** spec edge case "Long layoff → detect gap, restart with deloaded ramp" is
  unimplemented. After 3 weeks off, the app currently serves the same hard session as if nothing
  happened (ACWR=0 when chronic is 0 — guard exists but no explicit re-ramp).
- **Acceptance criteria:** a pure domain rule detects a gap (e.g. ≥ 14 days since last log) and
  forces a conservative re-entry (deload-volume week, capped intensity) with a clear reason shown
  on Today; tests cover gap boundary. If implemented inside `adaptation.ts` → safety-file protocol.
- **Files:** `src/domain/periodization.ts`

### BC-09 · Rest timer in the session player — `done (15c1e10, 2026-06-11)`

- **Type:** feature · **Priority:** P1 · **Complexity:** S · **Depends on:** —
- **Problem:** spec screen 3 includes a rest timer. Limit bouldering lives and dies on full rest
  (2–4 min); 4×4s need strict intervals. Phones at the gym are the timer — the app should be.
- **Acceptance criteria:** per-block start/stop rest timer with sensible defaults by session type
  (limit ≈ 3 min, 4×4 ≈ 1 min between problems / 4 min between rounds); audible/vibration cue;
  works with screen re-lock (PWA constraint — document what's feasible).
- **Files:** `src/app/lib/restTimer.ts`, `src/app/session/page.tsx`

### BC-10 · Data export / import (backup) — `open`

- **Type:** feature · **Priority:** P1 · **Complexity:** S · **Depends on:** —
- **Problem:** all training history lives in one browser's IndexedDB. Browser storage is evictable
  and phone loss = total data loss. Before any cloud sync exists, a JSON export/import is the
  cheapest insurance, and it future-proofs the eventual `IClimbRepo` cloud migration.
- **Acceptance criteria:** export downloads a single versioned JSON (profile, program, check-ins,
  logs); import restores it (replace, with confirmation); round-trip integration test via
  fake-indexeddb; entry points on a settings/profile surface.
- **Files:** `src/app/lib/backup.ts`, `src/app/profile/page.tsx`

---

## P2 — Polish & infrastructure that compounds

### BC-11 · Shared app shell: bottom tab navigation — `open`

- **Type:** ux · **Priority:** P2 · **Complexity:** S
- **Problem:** every page hand-rolls its own "← Today" link; the 2×2 nav grid exists only on
  Today. A mobile-first PWA wants a persistent bottom tab bar (Today / Session / Insights / More).
- **Acceptance criteria:** layout-level bottom nav on all pages, active-tab state, thumb-reachable;
  e2e nav smoke updated.
- **Files:** `src/app/layout.tsx`, new nav component, pages lose their ad-hoc links.

### BC-12 · Honest error/empty states — `done (21f6f7a, 2026-06-11)`

- **Type:** ux · **Priority:** P2 · **Complexity:** S
- **Problem:** `/session`'s load promise has no catch (silent infinite "Loading…" on failure);
  `/program` dead-ends at "No active program." with no way to create one; check-in has no
  already-checked-in-today state (it silently overwrites).
- **Acceptance criteria:** every page has explicit error + empty states with a recovery action;
  check-in pre-fills today's existing entry when present.
- **Files:** `src/app/session/page.tsx`, `src/app/program/page.tsx`, `src/app/checkin/page.tsx`.

### BC-13 · Severity levels for pain/soreness — `open`

- **Type:** ux/feature · **Priority:** P2 · **Complexity:** S
- **Problem:** the check-in body buttons toggle severity 0↔2; the spec models 1–3. Severity is
  recorded but can never be 1 or 3, and the engine can't distinguish "a bit tender" from "sharp."
- **Acceptance criteria:** tapping cycles none→1→2→3→none (or equivalent); insights log shows
  severity; if `adaptation.ts` later branches on severity, that's a separate safety-file PBI.
- **Files:** `src/app/checkin/page.tsx`.

### BC-14 · Real PWA icons (carried from HANDOFF) — `open`

- **Type:** infra/design · **Priority:** P2 · **Complexity:** S
- **Problem:** `public/icon.svg` is a placeholder mark; the manifest test enforces presence, not
  quality. Install-to-home-screen currently looks unfinished.
- **Acceptance criteria:** branded 192/512 maskable PNGs (+ apple-touch-icon), manifest updated,
  `tests/pwa/manifest.test.ts` extended to require the maskable purpose + both sizes.
- **Files:** `public/manifest.webmanifest`, `tests/pwa/manifest.test.ts`

### BC-15 · Deploy to Vercel (production URL) — `open`

- **Type:** infra · **Priority:** P2 · **Complexity:** S
- **Problem:** the app only exists on localhost; "installable PWA at the gym" requires HTTPS
  hosting. Stack decision already says Vercel.
- **Acceptance criteria:** production deployment from `main` (human runs the deploy/connects the
  repo — agents must not push); README documents the URL + deploy flow; service-worker update path
  verified once on the live origin (bump `CACHE` checklist noted in HANDOFF).
- **Files:** `README.md`, `docs/HANDOFF.md`

### BC-16 · Installability + offline e2e in CI (carried from HANDOFF) — `open`

- **Type:** ci/test · **Priority:** P2 · **Complexity:** M
- **Problem:** service-worker runtime behavior is the biggest acknowledged gate-blind risk —
  guarded today only by a string-content test. Offline shell load and manifest installability can
  regress silently.
- **Acceptance criteria:** a Playwright (or Lighthouse-CI) job asserts: SW registers, page loads
  offline after first visit, manifest passes installability audit. Runs in CI on the production
  build. This promotes the HANDOFF's top gate-blind risk to Tier-1.
- **Files:** `e2e/`, `.github/workflows/ci.yml`, possibly `playwright.config.ts`.

### BC-17 · CI speed: cache Playwright browsers — `open`

- **Type:** ci/optimization · **Priority:** P2 · **Complexity:** S
- **Problem:** CI reinstalls Chromium (~100 MB) on every run (`.github/workflows/ci.yml:27`).
- **Acceptance criteria:** `actions/cache` keyed on the Playwright version; install step skipped
  on hit; CI stays green.
- **Files:** `.github/workflows/ci.yml`

### BC-22 · Off-the-wall exercises (antagonist / core / mobility) — `open`

- **Type:** feature · **Priority:** P2 · **Complexity:** M · **Depends on:** —
- **Problem:** training is wall-only. Injury-resilient, well-rounded bouldering needs supplementary
  off-wall work — antagonist push (the app already tracks pull-heavy load), core, and shoulder/hip
  mobility. The engine prescribes climbing but nothing to balance it, which undercuts the "keep you
  out of injury" promise.
- **Acceptance criteria:** a pure domain module holds a small library of off-wall exercises tagged by
  purpose (`antagonist` | `core` | `mobility`) and picks a short, appropriate set for the day's
  session type (e.g. antagonist+core after a limit/strength day; mobility on rest/deload). Surfaced as
  a card on Today or the session player. Prescription logic lives in `src/domain` (pure, `asOf`-driven,
  tested); the page only renders. No new injury risk: additive only, never raises climbing load.
- **Files:** `src/domain/offWallExercises.ts`, `src/app/exercises/page.tsx`

### BC-23 · Visual redesign + branding (bright & playful, dark mode, climbing-hold motif) — `open`

- **Type:** ux/design · **Priority:** P2 · **Complexity:** L · **Depends on:** —
- **Problem:** the UI is functional but generic; the product wants a distinctive identity — bright,
  slightly playful/childlike, with climbing-hold motifs (in the spirit of a Bali bouldering-gym logo)
  and a real dark mode. Identity + dark mode also matter for an "installable PWA you open at the gym."
- **Acceptance criteria:** a cohesive token-based theme (light **and** dark) via CSS variables; a
  dark-mode toggle persisted locally (respects `prefers-color-scheme` on first load); a playful accent
  palette and hold-shaped motif on key surfaces (Today header, app icon/logo); applied consistently
  across pages with **no gate regression**. Theme tokens/toggle logic live in a covered
  `src/app/lib/theme.ts`, not scattered across components (per the gate-blind-UI rule).
- **Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/lib/theme.ts`

---

## P3 — Future bets (design-first; do not start while a P0 is open)

### BC-18 · Cloud sync behind `IClimbRepo` — `open` (design only)

- **Type:** system-design · **Complexity:** L
- The entire forward-compat investment was the repo seam — exercise it: spec a sync-capable
  implementation (e.g. Supabase/Postgres) with offline-first merge semantics (last-write-wins per
  entity is probably fine for single-user). Deliverable is a spec in `docs/specs/`, not code.
  Prereq: BC-10 (export gives a migration/backup path first).
- **Files:** `docs/specs/cloud-sync-design.md`

### BC-19 · Technique-drill rotation in volume sessions — `open`

- **Type:** feature · **Complexity:** M
- Volume/technique sessions say "one deliberate drill (e.g. silent feet)" but never pick one. Pull
  from `src/domain/drills.ts`, rotate week-to-week, and show the drill card inline in the session
  player. Closes the "no technique development" original problem beyond a passive library.
- **Files:** `src/domain/drills.ts`, `src/app/session/page.tsx`

### BC-20 · Training-day reminders — `open`

- **Type:** feature · **Complexity:** M
- Local notifications (PWA Notification + service worker) on `availableWeekdays` mornings:
  "Limit day today — check in first." Depends on BC-03 (real schedule) and BC-15 (HTTPS origin).
- **Files:** `src/app/lib/reminders.ts`

### BC-21 · Single repo instance — `open`

- **Type:** refactor · **Complexity:** S
- Every page constructs `new DexieClimbRepo()`. Works, but a module-level singleton (or a tiny
  provider) gives one Dexie connection and one seam to swap when BC-18 lands. Pure
  leave-it-better refactor; fold into another PBI's commit if convenient.
- **Files:** `src/data/repoInstance.ts`

### BC-24 · CV/ML technique coach — `open` (FUTURE; design only, do not start now)

- **Type:** system-design/ml · **Priority:** P3 · **Complexity:** XL · **Depends on:** —
- **Vision (explicitly future — PO said focus on current P1/P2 first):** analyze a climbing video with
  pose-estimation / computer vision to coach technique — hip positioning, silent feet, over-gripping,
  straight-arm efficiency — and feed observations into the existing adaptation/insights loop.
- **Acceptance criteria:** deliverable is a **design spec only** (`docs/specs/`). It should explore:
  on-device vs cloud inference (privacy default: video never leaves the device), a pose-estimation
  approach (e.g. MediaPipe/TF.js), how a "technique score" maps onto the current `feel`/insights model,
  and the UX of capturing/reviewing a clip. **No app code** until a future milestone schedules it.
- **Files:** `docs/specs/cv-technique-coach-design.md`

---

## Recommended order (dependency-aware)

```
BC-01 → BC-02 → BC-03 → BC-04 → BC-05   (P0: fix the program, then feed the engine)
→ BC-06 → BC-07 → BC-10                  (P1: personalize, build trust, protect data)
→ BC-08 → BC-09                          (P1: remaining spec gaps)
→ P2 in any order (BC-16 first if regressions bite; BC-15 whenever the human wants it live)
```

## Shipped log

_Move PBIs here when done: `BC-xx · title · commit · date`._

(none yet — backlog created 2026-06-10)
