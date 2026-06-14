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
in place; never delete a shipped PBI. When the **Open backlog** grows unwieldy, **condense** each
done PBI down to a single one-line header in the **Shipped log** (drop the Problem/AC/Files body —
git history + `docs/LEARNINGS.md` keep the detail). **Keep it as a `### BC-xx … — `done (commit)``
header, NOT a plain bullet:** the Crew scheduler resolves `Depends on:` against PBIs that parse as
`done` (`scripts/crew/lib/schedule.mjs` → `doneIds`), so collapsing a shipped PBI to a bullet would
silently make every open PBI that depends on it un-assignable. `tests/crew/backlog-hygiene.test.ts`
guards this (no dangling dependencies).

**Priorities:** P0 = the product's core promise is broken. P1 = spec'd v1 behavior still missing.
P2 = polish/infra that compounds. P3 = future bets, design-first.
**Complexity:** S/M/L/XL (never time estimates).

---

## Status — core loop complete ✅

**All P0 and P1 PBIs plus the first wave of P2 are shipped** (BC-01…BC-13, BC-15, BC-17, BC-22,
BC-23 — condensed in the [Shipped log](#shipped-log)). The program clock, timezone-correct dates,
real scheduling, climbing-data capture, the full adaptive rules engine (1–7), onboarding, the "why"
log, backup, rest timer, off-wall work, and the brand design system all exist and pass the gate.

**Open work below is P2** (polish / infra that compounds) **and P3** (design-first future bets).

---

## P2 — Polish & infrastructure that compounds

### BC-14 · Real PWA icons (carried from HANDOFF) — `done`

- **Shipped:** branded **maskable** PNGs (`public/icon-192.png`, `icon-512.png`) + `apple-touch-icon.png`,
  generated reproducibly from the hold-mark by `scripts/gen-icons.mjs` (`pnpm icons`, `sharp`) — full-bleed
  chalk so the launcher mask never letterboxes. Manifest lists the 192/512 PNGs (`purpose: any maskable`) +
  brand-refreshed `icon.svg` + brand colors; `layout.tsx` adds `icons.icon`/`icons.apple`. Manifest test now
  requires both maskable PNG sizes + the apple-touch-icon, all asserted to exist on disk.

- **Type:** infra/design · **Priority:** P2 · **Complexity:** S
- **Problem:** `public/icon.svg` is a placeholder mark; the manifest test enforces presence, not
  quality. Install-to-home-screen currently looks unfinished.
- **Acceptance criteria:** branded 192/512 maskable PNGs (+ apple-touch-icon), manifest updated,
  `tests/pwa/manifest.test.ts` extended to require the maskable purpose + both sizes.
- **Files:** `public/manifest.webmanifest`, `tests/pwa/manifest.test.ts`

### BC-16 · Installability + offline e2e in CI (carried from HANDOFF) — `done`

- **Shipped:** `e2e/offline.spec.ts` runs against the prod build — asserts the SW registers/activates, a
  precached route loads with the network cut (`context.setOffline`), and the manifest is installable
  (name/start_url/standalone + a maskable icon). Promotes the HANDOFF's top gate-blind (SW runtime) risk to
  Tier-1; runs in CI's existing `playwright test` step. **Lighthouse** added (`lighthouserc.json`,
  `pnpm lighthouse`, new `lighthouse` CI job) with category budgets (perf ≥ 0.80, a11y ≥ 0.90, BP ≥ 0.90,
  SEO ≥ 0.95 — buffered below the deployed 87/96/100/100 for the localhost-only Vercel-script 404s).

- **Type:** ci/test · **Priority:** P2 · **Complexity:** M
- **Problem:** service-worker runtime behavior is the biggest acknowledged gate-blind risk —
  guarded today only by a string-content test. Offline shell load and manifest installability can
  regress silently.
- **Acceptance criteria:** a Playwright (or Lighthouse-CI) job asserts: SW registers, page loads
  offline after first visit, manifest passes installability audit. Runs in CI on the production
  build. This promotes the HANDOFF's top gate-blind risk to Tier-1.
- **Files:** `e2e/`, `.github/workflows/ci.yml`, possibly `playwright.config.ts`.

### BC-25 · Dark mode (token theme + toggle) — `open` (design-first)

- **Type:** ux/design · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-23
- **Problem:** the delivered design system ships **light** chalk/basalt tokens only. A real dark theme
  still matters for an "installable PWA you open at the gym" in low light.
- **Acceptance criteria:** a dark token set layered over BC-23's CSS variables (chalk→deep basalt
  surfaces, ink→chalk text, holds re-tuned for contrast); a toggle persisted locally that respects
  `prefers-color-scheme` on first load; theme/toggle logic in a covered `src/app/lib/theme.ts`, not
  scattered across components; **no gate regression**. Coordinate hold-color contrast with the brand
  owner before shipping.
- **Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/lib/theme.ts`

### BC-26 · Tier-1 guard: dev-only tooling must stay out of production `dependencies` — `done`

- **Shipped:** `tests/harness/dependency-placement.test.ts` reads `package.json` and fails the gate
  (by name) if any of a data-driven denylist of dev-only tools (`playwright`, `@playwright/test`,
  `vitest`, `@vitest/*`, `eslint*`, `prettier`, `type-coverage`, `knip`, `dependency-cruiser`,
  `husky`, `lint-staged`, `@types/*`, `typescript-eslint`, `fake-indexeddb`) appears in production
  `dependencies`. Wildcard (`prefix*`) + exact matching via pure `isDevOnly`/`misplacedDevTools`
  helpers (mock-leak unit tests + the real-file assertion). Promotes the BC-11/Copilot "review caught
  what the gate missed" regression class (LEARNINGS 2026-06-12) to Tier-1; adding a dev tool is a
  one-line denylist edit. Verified non-vacuous: injecting `knip` into prod deps turns the gate red.
- **Type:** ci/test · **Priority:** P2 · **Complexity:** S
- **Problem:** the gate verifies a dependency is _used_, not that it sits in the _right_ section.
  GitHub Copilot's BC-11 merge added `playwright` (the full browser package) to production
  `dependencies`; `pnpm gate` stayed green because knip's Playwright plugin counts it "used"
  regardless of section. Caught only by human review → fixed in `b6c4f5c`. This is the third "review
  caught what the gate missed" class — promote it. (Root cause logged: LEARNINGS 2026-06-12.)
- **Acceptance criteria:** a Vitest test reads `package.json` and asserts a denylist of known
  dev-only tools (`playwright`, `@playwright/test`, `vitest`, `@vitest/*`, `eslint*`, `prettier`,
  `type-coverage`, `knip`, `dependency-cruiser`, `husky`, `lint-staged`, `@types/*`,
  `typescript-eslint`, `fake-indexeddb`) are absent from `dependencies` (devDependencies only).
  Fails the gate (by name) if any leak into `dependencies`. Keep the list data-driven so adding a
  dev tool is a one-line edit.
- **Files:** `tests/harness/dependency-placement.test.ts`, `package.json` (read-only). New test file.

> **Backlog extended 2026-06-12 (Claude Opus 4.8, brainstorming session):** BC-27…BC-43 added
> across four themes — training depth, stability/data-safety, infra/quality-bar, design/UX —
> plus 3 P3 vision bets. Every item was verified a real gap against the code, not assumed (e.g.
> `injuryHistory[]` is in the spec data model but absent from `src/domain/types.ts`; no
> `navigator.storage.persist()`, no `error.tsx`, no a11y/mutation/bundle gate exists).

> **— Training depth (deepen the coach's intelligence) —**

### BC-27 · Benchmark / assessment session — recalibrate `currentGrade` — `done`

- **Shipped:** pure `assessBenchmark({ logs, currentGrade, asOf }) → { measuredGrade, leveledUp }` in
  `src/domain/assessment.ts` — the measured grade is the highest grade SENT in ≥`SESSIONS_TO_CONFIRM`
  (2) distinct sessions within `LOOKBACK_DAYS` (42, ~one mesocycle). Counts a grade once per session
  (multi-block sends don't double-count), ignores out-of-window / future / unparseable-date logs, and
  yields `measuredGrade: null` on cold start (never NaN). The measure is **asymmetric**: `leveledUp` is
  true ONLY when measured > current — it never auto-lowers `currentGrade` (a regression is a coach
  conversation). `getTodaySession` surfaces `assessment` on `TodayResult` (training AND rest days);
  Today renders a success "You've leveled up!" Callout (never auto-applies). Accepting it calls the
  covered `levelUpProfile(profile, measuredGrade)` (raises current, lifts goal to stay ≥ current) →
  `applyProfile(repo, draft, regenerate=true)` (BC-06's regen path) → reloads Today. TDD:
  `assessment.test.ts` (11) covers confirm/threshold/window/future/unparseable/per-session/highest/
  no-demotion + `bootstrap.test.ts` covers the surfaced level-up, cold start, and `levelUpProfile`.
  `assessment.ts` 100% branch. `pnpm gate` green.
- **Type:** feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-06
- **Problem:** `UserProfile.currentGrade` is set once at onboarding (BC-06) and **never re-measured**.
  Progression rule 6 (BC-05) bumps a session's `targetGrade`, but the climber's _actual_ baseline grade
  — the anchor the whole program scales from — stays frozen. After weeks of clean V6 sends the program
  still calibrates as if they're a V5.
- **Value:** the program re-anchors to the climber's real level; progression compounds instead of drifting.
- **Acceptance criteria:**
  - A pure domain rule (new `src/domain/assessment.ts`) treats the peak-week limit session as a
    benchmark: derive a measured grade from recent `gradesSent` (e.g. highest grade sent in ≥2 sessions
    over the last cycle). `asOf`-driven, no I/O.
  - When the measured grade differs from `profile.currentGrade`, surface a "you've leveled up — update to
    V*n*?" prompt on Today; applying it updates the profile and regenerates the next mesocycle (reuse
    BC-06's regen path).
  - Never auto-applies without confirmation; never _lowers_ `currentGrade` automatically (regression is
    a coach conversation, not a silent demotion).
  - Tested: synthetic logs → measured grade incl. the not-enough-data and tie cases.
- **Files:** `src/domain/assessment.ts`, `src/app/lib/bootstrap.ts`, `src/app/page.tsx`

### BC-28 · Readiness score on Today — `done (PR #37)`

- **Shipped:** pure `computeReadiness(checkIn, metrics) → { score: 0..100, band, drivers }` in
  `src/domain/readiness.ts` — docks points for poor sleep/fatigue/soreness/pain + high ACWR, with the
  **safety bias baked in** (any sharp pain or ACWR > 1.5 forces `red`, mirroring adaptation rules 1 & 3;
  1.3–1.5 is a caution driver). Drivers are prioritised, most-significant-first. `getTodaySession`
  surfaces `readiness` on `TodayResult` from the **real** check-in only — a neutral-assumed day returns
  `null` (Today shows the existing check-in prompt, never a fake green); rest days return `null` too.
  New gate-blind `ReadinessCard` renders the band/score/bar + top 2 drivers. TDD: `readiness.test.ts`
  covers green/amber/red, both safety overrides, the caution band, clamp, and the empty-driver fallback;
  `bootstrap.test.ts` covers null-on-neutral / real-on-checkin. `pnpm gate` green.
- **Type:** feature · **Priority:** P2 · **Complexity:** S · **Depends on:** —
- **Problem:** the check-in captures sleep, fatigue, soreness, motivation and the engine computes ACWR,
  but the user never sees a single "how ready am I today" signal — the adaptation reasons explain _what
  changed_, not _your overall state_.
- **Value:** an at-a-glance green/amber/red readiness gauge makes the coach feel responsive and teaches
  load awareness.
- **Acceptance criteria:**
  - A pure `computeReadiness(checkIn, loadMetrics) → { score: 0..100, band: 'green'|'amber'|'red',
drivers: string[] }` in `src/domain/readiness.ts` (no I/O).
  - Combines sleep/fatigue/soreness/pain + ACWR with the safety bias baked in: any sharp pain or
    ACWR > 1.5 forces `red` regardless of the rest (mirrors the rules-engine precedence).
  - Today renders the gauge + top 1–2 drivers ("rough sleep, load creeping up"); a neutral-assumed day
    (BC-07) shows a muted/neutral state, never a fake green.
  - Fully tested incl. the pain/ACWR override branches.
- **Files:** `src/domain/readiness.ts`, `src/app/page.tsx`

### BC-29 · Injury-history-aware baseline (restore `injuryHistory[]`) — `done`

- **Shipped:** `injuryHistory?: BodyPart[]` restored to `UserProfile` (optional — legacy stored profiles
  lack it, read `?? []`); onboarding/profile UI exposes a body-part picker; `BackupV1` round-trips it
  (profile serialized whole; test asserts survival). New pure `src/domain/injuryBaseline.ts`
  `applyInjuryHistory(blocks, history)` — kept OUT of `adaptation.ts` so the safety file stays focused on
  same-day rules — softens crimp/mixed → open-hand for prior finger/wrist injuries and ADDS one prehab block
  per flagged part. **Additive-only safety contract tested** (never raises volume/intensity/grade).
  Threaded through `generateProgram` → `buildSession`. `validateProfile` rejects unknown body parts.

- **Type:** feature/safety · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-06
- **Problem:** the design's data model lists `UserProfile.injuryHistory[]` but `src/domain/types.ts`
  **dropped it** — so a climber with a prior A2 pulley tear or TFCC injury starts with the exact same
  aggressive crimp/sloper baseline as an uninjured one. The "keeps you out of injury" promise has only
  reactive (same-day pain) handling, no _historical_ memory.
- **Value:** past injuries lower the starting risk envelope — the most credible injury-prevention upgrade left.
- **Constraints:** if the adjustment lands in `adaptation.ts` it's a **safety file** (safety-critical-change
  skill + `safety-rule-reviewer` + 100% branch). **Prefer** expressing it in baseline generation
  (`warmup.ts`/`periodization.ts`) so `adaptation.ts` stays focused on same-day rules. Additive-safety
  contract: history may only _reduce_ baseline load/intensity, never raise it.
- **Acceptance criteria:**
  - `injuryHistory: BodyPart[]` restored to `UserProfile` + the onboarding/profile UI (BC-06 surface) +
    the backup schema (BC-10 `BackupV1` round-trips it).
  - A pure rule makes baseline sessions more conservative for flagged parts (prior PIP → open-hand
    default + finger-extensor prehab each session; prior shoulder → no overhead in the baseline warm-up).
  - Tested per body part, incl. the additive-only invariant (load never increases vs no-history).
- **Files:** `src/domain/types.ts`, `src/domain/warmup.ts`, `src/app/profile/page.tsx`, `src/app/lib/backup.ts`

### BC-30 · Grade-pyramid goal & gap tracking — `done`

- **Shipped:** pure additions to `src/domain/insights.ts` — `pyramidTarget(currentGrade, goalGrade)`
  builds a healthy target send-pyramid (single send at the goal, broadening downward by the triangular
  counts `[1,3,6,10,15]`, capped 5 levels deep so a far-off goal targets a base around `goal − 4`, and
  pulled up to "two below current" so a close goal still broadens the base; floored at VB).
  `pyramidGaps(actual, target)` returns the per-grade `{actual, target, shortfall}` (shortfall floored
  at 0); `biggestPyramidGap` picks the largest shortfall (ties broaden the base — lower grade wins);
  `describePyramidGap` is the cold-start-safe one-line read ("log a few sessions" → "your V4 base is
  thin…" → "solid all the way up to V*n*"). Insights overlays target-vs-actual bars + the sentence in
  a "Pyramid vs your goal" card (logic stays in the covered domain; the page only renders). TDD:
  `insights.test.ts` covers the target shape, depth cap, current-broadening, VB floor, gap clamp,
  tie-break, and the three sentence branches. `insights.ts` 100% branch. `pnpm gate` green.
- **Type:** feature · **Priority:** P2 · **Complexity:** M · **Depends on:** —
- **Problem:** Insights renders the climber's _actual_ send pyramid (BC-04 data) but shows no _target_
  pyramid and no read on whether the base is broad enough to safely chase `goalGrade`. Coaching wisdom:
  a wide base (many sends a few grades below max) precedes pushing the ceiling — the app has the data but
  draws no conclusion.
- **Value:** turns the pyramid from a logbook into guidance ("your V4 base is thin — broaden it before
  chasing V7").
- **Acceptance criteria:**
  - Pure `pyramidTarget(currentGrade, goalGrade)` + `pyramidGaps(actual, target)` extending
    `src/domain/insights.ts`: a healthy target distribution + per-grade shortfall.
  - Insights overlays target vs actual and names the biggest gap as a sentence.
  - Tested incl. the cold-start empty pyramid → a sensible "log some sessions" state, never NaN.
- **Files:** `src/domain/insights.ts`, `src/app/insights/page.tsx`

> **— Stability & data safety (protect the user's training history) —**

### BC-31 · Persistent storage + eviction warning — `done`

- **Shipped:** pure `src/app/lib/storage.ts` — `requestPersistence(navigator.storage)` feature-detects
  the Storage API, calls `persist()` (which both requests durability and reports the resulting state),
  and returns `'persisted' | 'transient' | 'unsupported'` (degrades silently when the API or `persist`
  is absent). `shouldWarnEviction(state, dismissed)` warns ONLY when storage is known `transient` and
  the user hasn't dismissed — `unsupported` stays quiet (no crying wolf when we can't measure the
  risk). Today requests persistence on load and renders a dismissible warning Callout (export-now link
  - dismiss persisted via `EVICTION_DISMISS_KEY`); the page only does the `navigator.storage` /
    localStorage I/O, decisions live in the covered lib. TDD: `storage.test.ts` (8) covers persisted /
    transient / unsupported / partial-support and every warn branch. `pnpm gate` green.
- **Type:** infra/stability · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-10
- **Problem:** all history lives in evictable IndexedDB (BC-10 named this the data-loss risk). The app
  never calls `navigator.storage.persist()` to request durable storage, and never tells the user when
  their data is at eviction risk.
- **Value:** the cheapest durability win before cloud sync (BC-18) exists.
- **Acceptance criteria:**
  - On first write (or app load), request persistent storage via `navigator.storage.persist()`;
    feature-detect and degrade silently where unsupported.
  - If `navigator.storage.persisted()` is false, show a dismissible banner explaining the risk + a
    one-tap link to export (BC-10).
  - The threshold/decision logic lives in a covered `src/app/lib/storage.ts` (not the page); the page
    only renders. Tested (persisted true / false / unsupported) with a mocked `navigator.storage`.
- **Files:** `src/app/lib/storage.ts`, `src/app/page.tsx`

### BC-32 · Schema-migration safety net + load-time integrity validation — `done`

- **Shipped:** integration test seeds a `version(1)` DB, opens it through `DexieClimbRepo` (`version(2)`),
  and asserts rows survive + the v2-only store works (fake-indexeddb). New pure `src/app/lib/integrity.ts`
  (`validateLog`/`partitionLogs`) checks each stored log's runtime shape on read; corrupt records (e.g. a
  non-numeric `sessionRPE` that would NaN the load engine) are **quarantined**, not crashed on. Wired at the
  app layer (`bootstrap.getTodaySession`, since `src/data` can't import `src/app`) — `TodayResult.dataIssues`
  surfaces a count, and Today shows a "some saved data looks damaged — restore from backup" Callout.

- **Type:** infra/stability · **Priority:** P2 · **Complexity:** M · **Depends on:** —
- **Problem:** `dexieRepo.ts` is already at `.version(2)` with no test proving a `version(1)→(2)`
  upgrade preserves rows, and nothing validates the _shape_ of data read back — a corrupt or partial
  record (truncated write, failed import) surfaces as an opaque downstream crash, not an honest "your
  data looks damaged" state.
- **Value:** schema evolution and corrupt data stop being silent data-loss vectors.
- **Acceptance criteria:**
  - An integration test seeds a `version(1)` DB, opens at `version(2)`, and asserts rows survive
    (fake-indexeddb).
  - A pure validator (`src/app/lib/integrity.ts`) checks each entity's shape on read; invalid records
    are quarantined + surfaced (not crashed on), with a recovery action (re-import from backup).
  - Tested: a malformed log/profile yields a typed validation error, not a throw mid-render.
- **Files:** `src/app/lib/integrity.ts`, `src/data/dexieRepo.ts`, `tests/domain/dexieRepo.test.ts`

### BC-33 · Global error boundary + crash recovery UI — `done`

- **Shipped:** App Router `src/app/error.tsx` (segment) + `src/app/global-error.tsx` (root, self-contained
  `<html>`/`<body>` + inline styles since it replaces the shell) render a branded recovery screen with
  **reload + "export your data"** actions and never expose a raw stack. Copy/actions/`safeErrorDigest` live
  in the covered `src/app/lib/errorRecovery.ts` (the digest strips the stack to a short single-line
  reference, logged to console only). Next 16 passes `unstable_retry` (NOT the old `reset`). _Note:_ the
  forced-throw e2e was descoped — triggering the boundary deterministically needs a prod throw hook, which
  would ship test code to production; the recovery logic is unit-tested and the boundaries are thin renderers.

- **Type:** ux/stability · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-10
- **Problem:** there is no `error.tsx`/`global-error.tsx` in `src/app`. Any unhandled render error blanks
  the screen with no message and no recovery path — the worst possible state for a single-device app
  holding irreplaceable data.
- **Value:** a crash becomes recoverable ("something broke — your data is safe; reload / export")
  instead of a dead white screen.
- **Acceptance criteria:**
  - App Router `error.tsx` (segment) + `global-error.tsx` (root) render a branded recovery screen with
    reload + "export your data" (BC-10) actions, never exposing a raw stack to the user.
  - The copy/decision logic (what actions to offer) lives in a covered `src/app/lib/errorRecovery.ts`,
    not inline in the boundary (gate-blind-component rule).
  - e2e: a forced throw renders the boundary, not a blank page.
- **Files:** `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/lib/errorRecovery.ts`, `e2e/error.spec.ts`

### BC-34 · Backup-reminder nudge — `done`

- **Shipped:** pure `src/app/lib/backupReminder.ts` — `shouldNudgeBackup(lastExportAt, asOf,
sessionsSinceExport)` fires when there is meaningful un-backed-up data (≥`NUDGE_AFTER_SESSIONS`=10
  new sessions, or a prior export older than `NUDGE_AFTER_DAYS`=30 with any new data), and stays quiet
  when nothing has changed or on a never-exported user below the session bar (no first-paint nag).
  `countSessionsSince(logDates, since)` counts logs strictly after the last export (null/unparseable →
  full history); `isSnoozed`/`snoozeUntilIso` implement a `SNOOZE_DAYS`=7 "remind me later" dismissal.
  Profile export stamps `LAST_EXPORT_KEY` + clears the snooze; Today renders a dismissible info Callout
  (export-now link + remind-me-later) — all decisions live in the covered lib, the pages only do the
  localStorage I/O. TDD: `backupReminder.test.ts` covers every threshold boundary + the snooze window;
  100% branch/line. `pnpm gate` green.
- **Type:** ux/stability · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-10
- **Problem:** BC-10 ships export/import but nothing reminds the user to do it. Evictable storage + a
  human who never exports = the same data-loss risk, just opt-in.
- **Value:** turns backup from a feature nobody finds into a habit.
- **Acceptance criteria:**
  - A pure `shouldNudgeBackup(lastExportAt, asOf, sessionCount)` rule (e.g. nudge after N new sessions
    or ≥30 days since last export) in `src/app/lib/backupReminder.ts`.
  - `lastExportAt` persisted on export; a dismissible Today banner surfaces the nudge with a one-tap export.
  - Pure, `asOf`-driven, tested at the threshold boundaries.
- **Files:** `src/app/lib/backupReminder.ts`, `src/app/lib/backup.ts`, `src/app/page.tsx`

> **— Infra & quality bar (compound the harness) —**

### BC-35 · Mutation testing on the safety files (Stryker) — `done`

- **Shipped:** `stryker.config.json` mutates ONLY `adaptation.ts` + `loadMetrics.ts` (vitest runner, plugin
  declared explicitly for pnpm). Separate `mutation` CI job (`pnpm mutation`), kept out of the inner gate.
  Surfaced real assertion gaps: added exact-boundary safety tests (ACWR 1.3/1.5, fatigue 4, sleep 2,
  progression RPE/`>=`, exact volume-halving + RPE-floor + warmup-mandatory + grip-scope) that lift the
  score to **90%** (loadMetrics 95%). Reason strings excluded as a justified ignore (UX copy, not safety
  rules). `break: 88` leaves margin for the one timeout-killed mutant; ratchet up, never down. eslint ignores
  `.stryker-tmp/**` (Stryker's `@ts-nocheck` sandbox copies).

> **Re-prioritized 2026-06-13 (P2 → P1):** a review of proposed test-quality upgrades (SAST/DAST/
> API-schema/BDD/load-test/mutation) confirmed mutation testing is the only one that fits a
> backendless IndexedDB PWA — the rest target a server surface this app doesn't have. Coverage is
> 100% branch on the safety files but assertion strength is unproven; this PBI closes that gap and is
> now the top harness-compounding item.

- **Type:** ci/test · **Priority:** P1 · **Complexity:** M · **Depends on:** —
- **Problem:** `adaptation.ts`/`loadMetrics.ts` are 100% _branch-covered_, but coverage proves lines
  _ran_, not that a wrong rule would be _caught_. The invariant fuzz test
  (`adaptation.invariants.test.ts`) is the real guard — mutation testing is how we prove it actually
  kills bugs (flip `>` to `>=` on the ACWR threshold and confirm a test fails).
- **Value:** upgrades the safety guarantee from "covered" to "provably caught" — squarely the repo's
  executable-over-prose ethos.
- **Acceptance criteria:**
  - Stryker configured to mutate **only** `src/domain/adaptation.ts` + `src/domain/loadMetrics.ts`
    (scoped — full-repo mutation is too slow for the gate).
  - A mutation-score threshold (start high, e.g. ≥90%) that fails CI on regression; runs as a separate
    job (kept out of the inner `pnpm gate` loop if too slow) but blocks merge on the safety files.
  - Document the command + threshold in `README`/`AGENTS.md`; surviving mutants get a test or a
    justified ignore.
- **Files:** `stryker.config.json`, `.github/workflows/ci.yml`, `package.json`

### BC-36 · Bundle-size budget (Tier-1 gate) — `done`

- **Shipped:** `scripts/check-bundle-size.mjs` (zero-dep, `node:zlib`) gzip-measures the App-Router first-load
  JS (build-manifest `rootMainFiles` + polyfills) and fails by number against the data-driven ceiling in
  `.size-limit.json` (200 KB; baseline ~168 KB). Wired as gate step **9/9** (`pnpm bundlesize`). The pure
  `summarizeBundle` is unit-tested (`tests/harness/bundle-size.test.ts`); the limit bumps one line with a
  justification so an intentional increase is a visible decision.

- **Type:** ci/test · **Priority:** P2 · **Complexity:** S · **Depends on:** —
- **Problem:** nothing bounds the JS shipped to the phone. A PWA opened on gym cell data degrades
  silently as dependencies creep — exactly the regression a green gate currently misses.
- **Value:** keeps the install fast and the "works at the gym" promise honest, by number not vibes.
- **Acceptance criteria:**
  - A gate step asserts the production first-load JS (from `next build` output, or a `size-limit`
    config) stays under an agreed ceiling; fails by number when exceeded.
  - The threshold is data-driven (one-line bump with a justification) so an intentional increase is a
    visible decision.
  - Wired into `pnpm gate` / CI; the current build sets the initial baseline.
- **Files:** `.size-limit.json`, `package.json`, `scripts/gate.sh`

### BC-37 · Accessibility audit gate (axe-core in e2e) — `done`

- **Shipped:** `e2e/a11y.spec.ts` runs `@axe-core/playwright` (WCAG 2 A/AA) against the prod build on every
  route + Today-after-onboarding; serious/critical violations fail (runs in CI's existing `playwright test`).
  Covers contrast, labels, focus order, and a reduced-motion smoke. Genuinely **fixed** the dominant neutral
  contrast (`--text-soft` #8d8497 3.57:1 → darkened ≥4.5:1, hierarchy kept). Remaining failures are all
  brand/semantic colour PAIRS (white-on-brand CTAs, success green, badge tints) — **baselined by colour pair
  with BC-25 references** (brand-owner palette pass); any NEW pair or non-contrast violation still fails.

- **Type:** ci/test · **Priority:** P2 · **Complexity:** M · **Depends on:** —
- **Problem:** no automated a11y check exists. A one-handed, thumb-driven, sweaty-fingers-at-the-gym app
  is precisely where contrast, hit-target size, focus order, and screen-reader labels matter — and
  precisely what's untested.
- **Value:** promotes accessibility from "hopefully" to a gate, and folds in reduced-motion/focus-visible coverage.
- **Acceptance criteria:**
  - `@axe-core/playwright` runs against the production build on every route; serious/critical violations
    fail CI.
  - Covers contrast (the bright brand palette is a real risk), labelled controls (check-in body-map
    taps, grade steppers), focus-visible, and `prefers-reduced-motion` honored.
  - Baseline current violations explicitly (fix or ticket each) so the gate starts green and stays green.
- **Files:** `e2e/a11y.spec.ts`, `.github/workflows/ci.yml`, `playwright.config.ts`

> **— Design & UX polish (make it feel finished) —**

### BC-38 · Insights data visualizations (trends over time) — `open`

- **Type:** ux/design · **Priority:** P2 · **Complexity:** M · **Depends on:** —
- **Problem:** Insights shows `StatCard`s + `ProgressBar`s — point-in-time numbers. The actual coaching
  signal is _trend_: load over weeks, ACWR trajectory toward/away from the red band, soreness frequency
  by body part. None of it is plotted.
- **Value:** the climber _sees_ the story (ramping too fast, plateauing, a recurring sore finger)
  instead of reading one number. Pairs with **BC-51** (the plain-language summary that reads the same
  chart out loud) — the PO asked for "a graph with a personalised analyser summary"; BC-38 is the
  graph, BC-51 the summary.
- **Acceptance criteria:**
  - Pure series-builders in `src/domain/insights.ts` (`loadSeries`, `acwrSeries`, `sorenessFrequency`) —
    `asOf`-windowed, tested; the page only renders.
  - Lightweight inline SVG charts (no heavy charting dep unless justified against bundle budget BC-36):
    a load/ACWR sparkline with the 0.8–1.3 band shaded, and a soreness-by-part frequency view.
  - Brand-consistent (hold rainbow / basalt), accessible (BC-37: labelled, not color-only),
    empty-state safe.
- **Files:** `src/domain/insights.ts`, `src/app/insights/page.tsx`, `src/app/components/Sparkline.tsx`

### BC-39 · Custom add-to-home-screen install prompt — `open`

- **Type:** ux/pwa · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-14
- **Problem:** no `beforeinstallprompt` handling exists. The whole pitch is "installable PWA you open at
  the gym," but the app never invites the install — it relies on the browser's easy-to-miss default.
- **Value:** more installs = more retention = the habit the product depends on.
- **Acceptance criteria:**
  - Capture `beforeinstallprompt`, suppress the default, and surface a tasteful in-app "Add to home
    screen" CTA at a sensible moment (not on first paint); dismissal persisted so it doesn't nag.
  - iOS (no `beforeinstallprompt`) gets a short "tap Share → Add to Home Screen" hint instead.
  - The trigger/dismissal logic lives in a covered `src/app/lib/install.ts`; the page renders. Tested
    (supported / unsupported / dismissed) with a mocked event.
- **Files:** `src/app/lib/install.ts`, `src/app/page.tsx`

### BC-40 · Training streak / consistency on Today — `done (PR #37)`

- **Shipped:** pure `computeConsistency(logs, profile, asOf) → { weekDoneCount, weekTarget,
currentStreakWeeks }` in `src/domain/consistency.ts` — counts sessions in the current rolling 7-day
  window and walks back over completed weeks for the streak. The **current week joins the streak only
  once it meets target, and never breaks it while in progress** (an unfinished week doesn't reset to 0).
  Future-dated logs ignored; TZ-stable local-day windows. Surfaced on `TodayResult` (training AND rest
  days) and rendered on Today as "X / Y sessions" + a `ProgressBar` + a supportive 🔥 streak line (no
  guilt-trip copy). TDD: `consistency.test.ts` covers empty, window inclusion/exclusion, future logs,
  in-progress-week-doesn't-break, multi-week extension, and the streak-break boundary. `pnpm gate` green.
- **Type:** ux/feature · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-03
- **Problem:** consistency is the strongest predictor of progress, yet the app surfaces nothing about it
  — no streak, no "sessions this week vs target," no gentle nudge when a planned day is slipping.
- **Value:** lightweight motivation that reinforces the core behavior without gamifying into junk.
- **Acceptance criteria:**
  - A pure `consistency(logs, profile, asOf) → { weekDoneCount, weekTarget, currentStreakWeeks }` in
    `src/domain/consistency.ts` (streak = consecutive weeks hitting `sessionsPerWeek`,
    missed-session-aware per BC-03).
  - Today shows "2 / 3 sessions this week" + a modest streak; honest on a miss (no guilt-trip copy —
    supportive coach voice per the design system).
  - Pure, `asOf`-driven, tested incl. the streak-break boundary.
- **Files:** `src/domain/consistency.ts`, `src/app/page.tsx`

> **Backlog extended 2026-06-13 (Claude Opus 4.8, PO hands-on-feedback session):** BC-44…BC-51 added
> from direct use of the live app, each verified a real gap against the code and grounded in
> [`research/2026-06-13-indoor-bouldering-program-best-practices.md`](research/2026-06-13-indoor-bouldering-program-best-practices.md)
> (cited coaching sources). Theme: **content depth & onboarding fidelity** — the app prescribes the
> right _shape_ but the text is thin, the floor excludes beginners, frequency is too narrow, and the
> program reads the same every week.

> **— Content depth & onboarding fidelity (the PO's hands-on feedback) —**

### BC-44 · Extend the grade scale down to VB / V0 — `done (PR #28)`

- **Type:** feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-06
- **Shipped:** new pure `src/domain/grade.ts` (`VB=-1`, `V0=0`, `MAX_GRADE`, `formatGrade`, `isValidGrade`).
  `bootstrap` validation + `periodization`/`session` floors read `VB`; `GradePill`, profile select, and
  the session player render via `formatGrade`. **Safety file touched:** `adaptation.ts` regression floor
  `Math.max(1, target-1)` → `Math.max(VB, target-1)` — a V0/VB climber missing targets now eases toward
  VB instead of being floored UP to V1 (the old code raised a beginner's grade on a regression), plus
  reason strings via `formatGrade` (never "V-1"). `safety-rule-reviewer`: **PASS**; the invariants
  fuzzer is unchanged and green.
- **Files:** `src/domain/grade.ts`, `src/domain/periodization.ts`, `src/domain/adaptation.ts` (safety),
  `src/app/lib/bootstrap.ts`, `src/app/components/GradePill.tsx`, `src/app/profile/page.tsx`,
  `src/app/session/page.tsx`
- **Problem:** the V-scale's beginner floor is **VB (V-Basic) and V0** — where most new climbers
  actually live — but `src/app/lib/bootstrap.ts` sets `MIN_GRADE = 1`, `validateProfile` rejects
  anything below V1, and `periodization.ts` / `session/page.tsx` floor every target with
  `Math.max(1, …)`. A genuine beginner can't even enter their grade, and `GradePill` only renders
  `` `V${n}` `` (no "VB"). (Research §1.)
- **Value:** the app can finally onboard and program for true beginners — the largest under-served
  segment — without faking them up to V1.
- **Acceptance criteria:**
  - A pure `src/domain/grade.ts` owns the scale: `MIN_GRADE = -1` (VB) / `V0 = 0`, a
    `formatGrade(g) → g < 0 ? 'VB' : 'V'+g`, and `isValidGrade`. `VGrade`'s doc comment documents the
    `VB=-1, V0=0` encoding.
  - `GradePill` and every `` `V${…}` `` call site render via `formatGrade` (so VB/V0 show correctly,
    incl. the hold-color map). `bootstrap.ts` validation + the `Math.max(1, …)` floors in
    `periodization.ts` read `MIN_GRADE`, not the literal `1`.
  - Onboarding/profile expose VB & V0 as selectable grades; goal-grade validation still requires
    `goal ≥ current`.
  - Tested: `formatGrade` for VB/V0/V5; validation accepts VB/V0 and still rejects sub-VB; a VB profile
    generates a program whose floored targets never throw / never render `V-1`.

### BC-45 · Sessions/week range 1–7 with frequency guidance + load notes — `done (PR #29)`

- **Type:** feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-06
- **Shipped:** `MIN_SESSIONS=1`/`MAX_SESSIONS=7`; `sessionPlanFor` returns a safe rotation for 1–7
  (one limit day + one PE day max; extras are low-intensity volume/technique + antagonist-prehab —
  additive-safety, never more max-effort climbing). New pure `src/domain/frequencyNotes.ts`
  (`frequencyGuidance(n) → { caution, text }`): 1× = "make it your quality day", ≥5× = a
  load-management caution (rest/sleep/tweak). Profile offers 1×…7× and renders the note in a
  `Callout` (info/warning by `caution`). TDD: `frequencyNotes.test.ts` (new) + extended
  `periodization.test.ts` (1..7 invariant) + `profile.test.ts` (1..7 band). `pnpm gate` green.
- **Problem:** `sessionsPerWeek` is clamped **2..4** (`MIN_SESSIONS`/`MAX_SESSIONS` in `bootstrap.ts`)
  and `sessionPlanFor` only has cases for 2/3/4. A once-a-week climber and a near-daily climber both
  exist; the PO asked for "**1x or even 7x, but with notes of course**." High frequency without a
  warning is an injury-load footgun. (Research §3 weekly-mix.)
- **Value:** serves the realistic range of schedules and _teaches_ load awareness instead of silently
  capping it.
- **Acceptance criteria:**
  - `MIN_SESSIONS = 1`, `MAX_SESSIONS = 7`; `sessionPlanFor` returns a sensible rotation for **1–7**
    (1 = one quality session; high counts fill with volume/technique + recovery, **never** stacking
    limit days — never two limit/PE days back-to-back, per the DUP tenet).
  - A pure `src/domain/frequencyNotes.ts` returns guidance per frequency (e.g. 1× = "make it your
    quality session"; ≥5× = an explicit **load-management caution** + a rest-day reminder). Surfaced on
    the profile/onboarding frequency control.
  - Additive-safety: raising frequency must not raise per-session intensity beyond the existing rules;
    extra sessions skew to lower-intensity volume/skill/recovery.
  - Tested: rotation for each of 1..7; the note text per band; the no-back-to-back-limit invariant.
- **Files:** `src/domain/periodization.ts`, `src/domain/frequencyNotes.ts`, `src/app/lib/bootstrap.ts`, `src/app/profile/page.tsx`

### BC-46 · Exercise content model — structured steps, dosage & image convention (foundation) — `done (PR #30)`

- **Type:** infra/feature · **Priority:** P2 · **Complexity:** M · **Depends on:** —
- **Shipped (together with BC-49 — a foundation with no consumer is dead code knip rejects, so it
  landed with its first user):** pure `src/domain/exerciseContent.ts` (`ExerciseContent` shape:
  `steps`/`cues`/`commonMistakes`/`dosage?`/`imageId?`; `imagePathFor` → `public/exercises/<id>.svg`
  with a `_placeholder.svg` fallback so there's never a broken `<img>`; `hasRichContent`).
  Presentational `src/app/components/ExerciseDetail.tsx` renders it; logic stays in the covered domain
  file. Assets + convention in `public/exercises/` (`README.md`, `_placeholder.svg`, `silent-feet.svg`,
  `band-pull-apart.svg`). Reused by BC-47/49/50.
- **Problem:** every exercise surface (session blocks, drills, prehab/off-wall) carries only a one-line
  string. The PO wants **detailed todos, instructions, and images** across all of them. Building that
  three separate times would diverge — this PBI is the **shared foundation** (the repo's "use the
  tested helper, don't re-implement" rule). (Research §3, §6.)
- **Value:** one content model + one detail component that BC-47/48/49/50 reuse — consistent,
  testable, image-ready.
- **Acceptance criteria:**
  - A pure `src/domain/exerciseContent.ts` defines a reusable shape: `steps: string[]` (ordered
    how-to), `cues: string[]` (form), `commonMistakes: string[]`, `dosage?` (sets×reps×rest),
    `imageId?`, and a pure `imagePathFor(imageId)` resolving to a `public/exercises/<id>.*` convention
    (feature-detect/placeholder when an asset is missing — no broken `<img>`).
  - A presentational `src/app/components/ExerciseDetail.tsx` renders that shape (image + steps + cues +
    mistakes + dosage), brand-consistent and a11y-labelled (pairs with BC-37). It's gate-blind by
    design, so **all selection/format logic stays in `exerciseContent.ts`** (covered).
  - At least a couple of real assets land under `public/exercises/` to prove the path convention;
    missing-asset path renders a tasteful placeholder, tested via `imagePathFor`.
  - Tested: `imagePathFor` (present/missing), the content-shape builders.
- **Files:** `src/domain/exerciseContent.ts`, `src/app/components/ExerciseDetail.tsx`, `public/exercises/README.md`

### BC-47 · Rich session player — detailed todos, instructions & images per block — `done (PR #33)`

- **Type:** ux/feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-46, BC-04
- **Shipped:** `Block` gained an optional `content?: ExerciseContent` (BC-46 shape). `periodization`'s
  new `mainContentFor(type)` populates every main block with cited specifics (limit = 3–5 moves + long
  rest; 4×4 = 4 boulders × 4 rounds × 4-min rest; volume = 10–20 climbs 3–4 below flash + 1–2 drill
  intentions; antagonist circuit). The session player shows a collapsible **"How to do this"** →
  `ExerciseDetail` (image + steps + cues + mistakes) per block — closing "tapping Start is vague".
  Session-type illustrations added under `public/exercises/`. TDD: `periodization.test.ts` asserts
  every main block carries steps + an image. `pnpm gate` green.
- **Problem:** the home page tells the climber _what_ to do, but tapping **Start** drops them into a
  session where each block is just a name + `target: N × grip · Vx · RPE`. There are **no step-by-step
  instructions, no form cues, no images** — the "vague after Start" complaint. `Block.notes` is a
  single sentence. (Research §3 has the concrete per-type parameters to show.)
- **Value:** the session becomes self-guiding — a climber who's never done a 4×4 can execute it
  correctly from the screen.
- **Acceptance criteria:**
  - `Block` gains optional structured content (reuse BC-46's shape: `steps`/`cues`/`imageId`/`dosage`);
    `periodization.ts` populates each generated block with the cited specifics (limit = 3–5 moves, long
    rest; 4×4 = 4 boulders × 4 rounds, 4-min rest; volume = 10–20 climbs 3–4 below flash, 1–2 drill
    intentions; warm-up steps).
  - The session player renders `ExerciseDetail` per block (collapsible to stay thumb-friendly) — the
    logging controls are unchanged.
  - Logic (which content for which block) lives in the covered domain layer, not the gate-blind page.
  - Tested: generated blocks carry the right content per `SessionType`/phase; no block ships with empty
    instructions.
- **Files:** `src/domain/types.ts`, `src/domain/periodization.ts`, `src/app/session/page.tsx`

### BC-48 · Week-to-week program variation + clickable program detail — `done (PR #34)`

- **Type:** feature · **Priority:** P2 · **Complexity:** L · **Depends on:** BC-46
- **Shipped:** `generateProgram` now varies weeks within a phase — a `phaseRunOrdinal` (count of earlier
  same-phase weeks) drives **progressive overload** (each successive hard/peak/deload week adds main
  volume), and the volume day's **technique drill rotates by `weekIndex`** (`drillForWeek`, pulled from
  `DRILLS` — absorbs BC-19). `/program` is now **clickable**: tap a week → its sessions → a read-only
  session view rendering every block's target + collapsible `ExerciseDetail` (BC-46/47 reuse). Closes
  both halves of "the program is the same every week / let me click into it." TDD: `periodization.test.ts`
  asserts real week-to-week content variation, progressive overload, and deterministic drill rotation.
  `pnpm gate` green.
- **Problem:** **two real defects in one complaint** ("the program is still badly texted, every week is
  the same … my advice: click on the program and see what exercises/todos with instructions and
  images"). (1) `generateProgram` emits the **identical** `mainBlocksFor(...)` blocks for every week of
  a phase — only `PHASE_VOLUME` scales the set count — so progressive overload is absent and weeks read
  the same (Research §2). (2) `/program` lists weeks/phases but you can't **drill into** a week to see
  the actual prescribed blocks with their (BC-47) instructions/images.
- **Value:** the program _progresses_ (and _looks_ like it does), and becomes explorable instead of an
  opaque phase list.
- **Acceptance criteria:**
  - `weekIndex` becomes a real input to block generation: within a phase, ramp intensity/volume
    week-on-week (progressive overload) and **rotate** the technique-drill and prehab focus so
    consecutive weeks differ (closes/absorbs the open **BC-19** drill-rotation idea — cross-ref it).
    Stays pure + `asOf`-free; the safety contract (no back-to-back limit, additive-only) holds.
  - `/program` gains a tap-through: week → session → the real blocks rendered with BC-47/BC-46
    `ExerciseDetail` (instructions + images). Reuse the session-detail rendering; don't fork it.
  - Tested: two weeks of the same phase are **not** byte-identical (different drill/progression);
    the drill rotation cycles deterministically; clickable detail resolves a real session.
- **Files:** `src/domain/periodization.ts`, `src/app/program/page.tsx`

### BC-49 · Drills — step-by-step instructions, common mistakes & images + detail view — `done (PR #30)`

- **Type:** ux/feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-46
- **Shipped (with BC-46):** `Drill` now `extends ExerciseContent`; every drill has real `steps`,
  `commonMistakes`, and an `imageId` (silent-feet & band-pull-apart have illustrations; the rest fall
  back to the placeholder until art lands). `/drills` is now list → tap "Instructions" → `ExerciseDetail`
  (image + steps + cues + mistakes + dosage). The "Instructions" CTA is gated on `hasRichContent`. TDD:
  `drills.test.ts` asserts every drill carries rich content. `pnpm gate` green.
- **Problem:** `drills.ts` gives each drill a one-line `description` + a few `cues[]`, and `/drills`
  lists them flat. The PO wants drills that "have instructions, can go into detail, have images." No
  step-by-step, no common-mistakes, no imagery, no detail view.
- **Value:** the drill library becomes a real coaching reference, not a glossary.
- **Acceptance criteria:**
  - Each `Drill` adopts BC-46's content shape (`steps`, `commonMistakes`, `imageId`) alongside the
    existing `cues`; the data is filled for every drill with accurate, sourced content.
  - `/drills` becomes list → tap → `ExerciseDetail` (image + steps + cues + mistakes).
  - Tested: every drill has non-empty `steps`; `getDrill`/category filters still hold; the detail
    resolver returns the right drill.
- **Files:** `src/domain/drills.ts`, `src/app/drills/page.tsx`

### BC-50 · Prehab / off-wall — dosage, how-to steps & images + detail view — `done (PR #32)`

- **Type:** ux/feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-46, BC-22
- **Shipped:** `OffWallExercise extends ExerciseContent`; every exercise now has a concrete `dosage`
  (sets × reps), `steps`, `commonMistakes`, and an `imageId`. `/exercises` shows the dosage in the
  list and is now list → "Instructions" → `ExerciseDetail`. **Additive-only safety contract preserved**
  — content is instructional text only, with no path into `adaptation.ts`/`loadMetrics.ts`; the
  `prescribeOffWall` additive invariants are unchanged and still green. TDD: `offWallExercises.test.ts`
  asserts every exercise carries dosage + rich content. `pnpm gate` green.
- **Problem:** `offWallExercises.ts` gives each exercise a one-line `description` and no **dosage**
  (sets × reps), no how-to steps, no images; `/exercises` lists them flat. The PO wants prehab to
  "have instructions, go into detail, have images — same as drills."
- **Value:** prehab/antagonist work becomes executable from the screen (correct dosage + form), which
  is exactly where injury-prevention adherence is won or lost.
- **Acceptance criteria:**
  - Each `OffWallExercise` adopts BC-46's content shape incl. a concrete `dosage` (e.g. "3 × 12, slow
    eccentric"); content filled for every exercise. **Additive-only safety contract preserved** — this
    module still must never raise climbing load and stays out of `adaptation.ts`/`loadMetrics.ts`.
  - `/exercises` becomes list → tap → `ExerciseDetail`.
  - Tested: every exercise has dosage + non-empty steps; `prescribeOffWall` / purpose filters unchanged;
    the additive-only invariant still asserted.
- **Files:** `src/domain/offWallExercises.ts`, `src/app/exercises/page.tsx`

### BC-51 · Personalised Insights analyser summary — `done (PR #35)`

- **Type:** feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-30
- **Shipped (built over signals that exist today; BC-30 not required):** pure
  `summariseInsights(insights, acwr, asOf)` in `src/domain/insights.ts` composes 1–4 prioritised,
  supportive-coach sentences — **safety leads** (ACWR > 1.5 or a recent sharp-pain flag is the first
  sentence, mirroring the rules-engine precedence), then a pyramid read (broad base → "ready to touch
  V*n*"; top-heavy → "broaden the base"), then a consistency close. Cold start (no sessions) returns one
  honest "log a few sessions" line — never a fake-confident claim or NaN. Insights renders a **"Coach's
  read"** card above the charts. Deterministic, on-device — the sibling of the future LLM **BC-42**.
  TDD: `insights.test.ts` covers every branch incl. safety-leads-first ordering and the empty state.
  `pnpm gate` green. (Gets richer automatically once BC-30 pyramid gaps / BC-40 streak land.)
- **Problem:** the PO wants Insights to be "a graph **with a personalised analyser summary**." **BC-38**
  delivers the graph; this PBI delivers the **plain-language read** over the same data — the
  deterministic, on-device sibling of the future AI review (**BC-42**). Today Insights shows numbers
  with no narrative ("what does this mean for me?"). (Research §5.)
- **Value:** the climber gets a coach's one-paragraph takeaway ("V4 base is broad — start touching V6;
  load is climbing, keep a rest day") instead of decoding stats.
- **Acceptance criteria:**
  - A pure `summariseInsights(...)` in `src/domain/insights.ts` composes 2–4 prioritised, templated
    sentences from existing signals (pyramid gaps BC-30, load/ACWR band, soreness frequency, streak) —
    `asOf`-driven, **deterministic** (no LLM), supportive-coach voice, safety-aware (an ACWR-red or
    sharp-pain signal leads the summary).
  - Cold-start (sparse data) yields an honest "log a few sessions and I'll read the trend," never NaN
    or a fake-confident claim.
  - Insights renders the paragraph above/below the BC-38 chart; logic stays in the covered domain layer.
  - Tested: each sentence-trigger branch incl. the safety-leads-first ordering and the empty state.
- **Files:** `src/domain/insights.ts`, `src/app/insights/page.tsx`

> **Backlog extended 2026-06-13 (Claude Opus 4.8, PO hands-on-feedback session #2):** BC-52…BC-54
> added from continued use of the live app. **These are verified defects/gaps in already-`done` PBIs
> (BC-47, BC-48)** — the right _shape_ shipped, but the detail the home page promises is dropped the
> moment you tap **Start**, and the 6-week program still _reads_ identical week to week even though
> BC-48 made the underlying blocks vary. Each was traced to an exact line, not assumed. Root smell:
> three surfaces (Today `page.tsx`, the session player, the program preview) each render a `Block`
> differently — `notes` is shown in one and silently dropped in the other two.

> **— Content-fidelity defects (PO feedback round 2) —**

### BC-52 · Warm-up & cooldown detail vanishes when you tap "Start" — `done (PR #36)`

- **Shipped:** `generateWarmup()` (every warm-up block), `cooldownPrehab()`, and the rest-day
  `recoveryBlock()` (`schedule.ts`) now carry BC-46 `ExerciseContent` (`steps`/`cues`/`commonMistakes`
  - an `imageId`) at `mainContentFor` quality, so the player's "How to do this" → `ExerciseDetail` now
    appears for warm-up/cooldown/rest too. New SVGs: `warmup-raise`, `warmup-mobilize`,
    `warmup-potentiate`, `cooldown-prehab`, `active-recovery`. The session player **and** program preview
    now render each block's one-line summary via BC-54's shared `BlockSummary`, so they never show
    **less** than Today. TDD: `warmup.test.ts` / `schedule.test.ts` / `periodization.test.ts` assert that
    **every** block in a generated session carries `hasRichContent` content (mirrors BC-47's main-block
    invariant — no block ships detail-less). `pnpm gate` green.
- **Type:** bug/ux · **Priority:** P1 · **Complexity:** M · **Depends on:** BC-46, BC-47
- **Problem (verified, two linked defects):** the home page shows a real per-block plan — e.g.
  "Raise: light cardio — _5–10 min jog / row / skip to raise heart rate_", "Activate & Mobilize —
  _arm circles, wrist rotations, finger tendon glides_" — by rendering `Block.notes`
  (`src/app/page.tsx:160-164`). But tapping **Start** drops you into a session where **none of that
  detail exists**:
  1. **The session player never renders `b.notes`.** `src/app/session/page.tsx` renders the name +
     `target: sets × grip · RPE` (lines 292-307) and a collapsible "How to do this" **only when**
     `b.content && hasRichContent(b.content)` (line 309) — it never prints `notes`. So the one-line
     warm-up text the home page shows is silently dropped.
  2. **Warm-up & cooldown blocks carry no `content`.** BC-47's `mainContentFor()` only populated
     `category: 'main'` blocks; `generateWarmup()` (`src/domain/warmup.ts`) and `cooldownPrehab()`
     (`src/domain/periodization.ts:275-285`) set **only `notes`, no `ExerciseContent`**. So warm-up
     and cooldown fail the `hasRichContent` guard → no "How to do this" button either. Net: the
     climber sees "Raise: light cardio · 1 × open-hand · RPE 3" with **zero guidance** — exactly the
     PO's "when I start and log session it doesn't exist and doesn't go into detail."
  - The same gap exists in the program preview (`SessionBlocks`, `src/app/program/page.tsx:209-241`):
    it also doesn't render `notes`, and warm-up/cooldown have no `content`, so those blocks are blank
    there too.
- **Value:** closes BC-47's actual promise ("tapping Start is self-guiding") for the **warm-up** — the
  one part of every session the app insists is mandatory (`warmupMandatory`) yet currently explains
  the least. A climber who doesn't know what "potentiate" or "tendon glides" means gets actionable
  steps + an image instead of a bare label.
- **Acceptance criteria:**
  - Warm-up blocks (`generateWarmup`) and the cooldown block(s) (`cooldownPrehab`, and the
    `schedule.ts` rest-day cooldown) adopt BC-46's `ExerciseContent` (real `steps`/`cues`/
    `commonMistakes` + an `imageId`, matching the existing `mainContentFor` quality), so the
    "How to do this" → `ExerciseDetail` appears for them in the session player **and** the program
    preview. The how-to text must agree with the existing `notes` summary (no contradiction).
  - **Nothing the home page shows is dropped after Start:** the session player and the program preview
    render the block's one-line summary (`notes`, or its `ExerciseContent` equivalent) so the three
    surfaces are consistent. (Prevention belongs in BC-54's shared component, but BC-52 must not leave
    the player showing _less_ than Today.)
  - Content-selection logic stays in the **covered domain layer** (`warmup.ts` / `periodization.ts`),
    never inline in the gate-blind pages.
  - Tested: every warm-up block and every cooldown block carries `hasRichContent` content (a
    `periodization.test.ts` / `warmup.test.ts` invariant — _no_ block in a generated session ships
    detail-less, mirroring BC-47's "no main block has empty instructions" test). New warm-up/cooldown
    SVGs land under `public/exercises/` or fall back to the placeholder (no broken `<img>`).
- **Files:** `src/domain/warmup.ts`, `src/domain/periodization.ts`, `src/domain/schedule.ts`,
  `src/app/session/page.tsx`, `src/app/program/page.tsx`, `tests/domain/warmup.test.ts`,
  `public/exercises/README.md`

### BC-53 · The 6-week program reads identically every week (variation is invisible) — `done (PR #36)`

- **Shipped:** pure `weekHeadline(week)` in `periodization.ts` composes a **differentiating** one-line
  summary from real data — build ordinal + progressive-overload cue (`base volume` / `+1 set` /
  `+2 sets` / `recover`) + the week's rotating drill focus — so two same-phase weeks (e.g. week 0 vs
  week 3, both `hard`) read **differently**. The program week card renders it instead of the constant
  session-type rotation (still reachable by expanding the week). The drill-down `SessionBlocks` now
  renders each block's `notes` (via `BlockSummary`), so the rotating drill + progression are visible
  after clicking in. Pure, `asOf`-free, derived from canonical `PHASE_PATTERN`. TDD:
  `periodization.test.ts` asserts same-phase weeks differ + the overload/phase labels. `pnpm gate` green.
- **Follow-up (PO feedback, pending commit):** the first cut read "Build 1 · base volume · focus:
  Silent feet" — the PO objected that the volume-day's rotating drill ("Silent feet") was mislabelled
  as the **whole week's** focus when it isn't. Replaced `weekHeadline` (string) with
  `weekSummary(week) → { title, detail }`: the `title` ("Build 1"/"Deload"/"Peak") is the week's
  Badge; the `detail` is an honest supportive-coach sentence of **what to do this week and why** (no
  drill mislabel) — e.g. "Build 1 — Lay your base: repeatable quality volume… leave a rep in reserve."
  Builds 1/2/3 + the two deloads (mid-cycle vs end-of-cycle) all read distinctly. Tests updated.
- **Type:** bug/ux · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-48
- **Problem (verified):** the PO reports "the 6-week program section, the description is all the same
  from week 1 all the way to week 6 — _hard · limit boulder · power endurance · volume technique ·
  antagonist prehab_." True at the list level: the week summary renders only
  `w.sessions.map((s) => s.type.replace('-', ' ')).join(' · ')` (`src/app/program/page.tsx:177`) —
  the session-type **rotation is constant for all 6 weeks**, and three of the six weeks share the
  `hard` phase badge. BC-48 _did_ add genuine week-to-week variation (progressive-overload set bumps
  via `phaseRunOrdinal`, and a technique drill that rotates by `weekIndex` — `drillForWeek`), **but
  none of it is surfaced at the week level**, so every card looks identical. Worse, the one place the
  rotating drill lives is `Block.notes` (`periodization.ts:252`), and the program drill-down
  `SessionBlocks` (`program/page.tsx:209-241`) **doesn't render `notes`** — so even after you click
  in, the week-distinguishing detail is invisible.
- **Value:** the program _looks_ like the progressive, varied plan BC-48 actually built — the climber
  can see week 4 is heavier than week 1 and that this week's technique focus is "silent feet" vs next
  week's "heel hooks," instead of six identical-looking rows.
- **Acceptance criteria:**
  - A pure, tested helper (e.g. `weekHeadline(week)` in `src/domain/periodization.ts`) composes a
    **differentiating** one-line summary per week from the real data: phase intent + a progression cue
    (e.g. "Build 2 · +1 set" / "Peak" / "Deload") + the week's drill focus where relevant — so two
    weeks of the same phase produce **different** summaries. `asOf`-free, deterministic; the page only
    renders it (logic-in-covered-layers rule).
  - The week card surfaces that summary instead of (or alongside) the constant rotation list.
  - The program drill-down (`SessionBlocks`) renders each block's `notes`/summary so the rotating
    drill + progression are visible after clicking in (pairs with BC-52's "don't drop `notes`" fix).
  - Tested: `weekHeadline` differs for two same-phase weeks (e.g. week 0 vs week 3, both `hard`); the
    deterministic drill/progression labels match the generated blocks. (Reuses BC-48's existing
    "weeks are not byte-identical" fixture.)
- **Files:** `src/domain/periodization.ts`, `src/app/program/page.tsx`, `tests/domain/periodization.test.ts`

### BC-54 · Shared `BlockSummary` component — kill the three-surface render drift — `done (PR #36)`

- **Shipped:** presentational `src/app/components/BlockSummary.tsx` (gate-blind, no business logic) is
  now the single source of truth for a block's descriptive header — name + category badge + target line
  - one-line `notes` summary + an optional `children` slot (the player's collapsible how-to / the
    program's `ExerciseDetail`). All three surfaces (Today, session player, program preview) render
    through it; `leading` carries the warm-up checkbox, `showGrade={false}` lets Today keep its
    `GradePill`. This removes the divergence that caused BC-52 — a surface can no longer show **less**
    than another. `Badge`/`formatGrade` imports dropped from the pages now that the component owns them.
    `pnpm gate` green (knip: used by all three).
- **Type:** refactor/infra · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-52
- **Problem:** a `Block` is rendered **three different ways** today — Today (`src/app/page.tsx:137-168`,
  shows `notes`), the session player (`src/app/session/page.tsx:292-327`, drops `notes`, shows
  `content`), and the program preview (`src/app/program/page.tsx:209-241`, drops `notes`, shows
  `content`). This divergence is the **root cause** of BC-52 (the home page promised detail the player
  dropped). Without one component, the next surface will drift again. This is a clean
  leave-it-better-than-you-found-it consolidation (< 100 lines).
- **Value:** one presentational source of truth for "render a block's name + target + summary +
  optional how-to" means a surface can never again show _less_ than another. Prevents BC-52 from
  silently regressing.
- **Acceptance criteria:**
  - A presentational `src/app/components/BlockSummary.tsx` (gate-blind by design, **no logic** — it
    carries no branches the coverage gate would need) renders name + category badge + `target` line +
    `notes`/summary + the optional collapsible `ExerciseDetail`. Reused by all three surfaces.
  - The three pages render via it; **no behavior change** beyond consistency (the logging controls in
    the session player stay where they are — `BlockSummary` is the descriptive header, not the form).
  - `pnpm gate` green (knip: the component must be _used_ by all three, not orphaned).
- **Files:** `src/app/components/BlockSummary.tsx`, `src/app/page.tsx`, `src/app/session/page.tsx`,
  `src/app/program/page.tsx`

---

## P3 — Future bets (design-first; do not start while a P0 is open)

### BC-18 · Cloud sync behind `IClimbRepo` — `open` (design only)

- **Type:** system-design · **Complexity:** L
- The entire forward-compat investment was the repo seam — exercise it: spec a sync-capable
  implementation (e.g. Supabase/Postgres) with offline-first merge semantics (last-write-wins per
  entity is probably fine for single-user). Deliverable is a spec in `docs/specs/`, not code.
  Prereq: BC-10 (export gives a migration/backup path first).
- **Files:** `docs/specs/cloud-sync-design.md`

### BC-19 · Technique-drill rotation in volume sessions — `done (PR #34, via BC-48)`

- **Type:** feature · **Complexity:** M
- **Note (2026-06-13):** the week-to-week drill rotation here is now part of **BC-48**'s scope (program
  variation). Keep this only if BC-48 ships without it; otherwise close it alongside BC-48. Don't build
  both — they edit the same `periodization.ts` rotation.
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

### BC-24 · CV/ML technique coach — `open` (FUTURE; **design spec drafted 2026-06-13**, no app code until scheduled)

- **Type:** system-design/ml · **Priority:** P3 · **Complexity:** XL · **Depends on:** —
- **Vision (explicitly future — PO said focus on current P1/P2 first):** analyze a climbing video with
  pose-estimation / computer vision to coach technique — hip positioning, silent feet, over-gripping,
  straight-arm efficiency — and feed observations into the existing adaptation/insights loop.
- **Acceptance criteria:** deliverable is a **design spec only** (`docs/specs/`). It should explore:
  on-device vs cloud inference (privacy default: video never leaves the device), a pose-estimation
  approach (e.g. MediaPipe/TF.js), how a "technique score" maps onto the current `feel`/insights model,
  and the UX of capturing/reviewing a clip. **No app code** until a future milestone schedules it.
- **Research done (2026-06-13):** feasibility + landscape in
  `docs/research/2026-06-13-computer-vision-climb-analysis-feasibility.md` (9 sources). Key findings to
  bake into the spec: (1) **MVP is an L slice of this XL** — on-device in-browser **MediaPipe** pose,
  capture glue in `src/app/**`, analysis as a **pure `src/domain/technique.ts`** (keypoint arrays →
  rule-based flags + CoM path; tested with JSON keypoint fixtures, no video in CI → clears the per-file
  coverage bar). (2) Reuse **PMC10574944's six geometric beginner-error rules** (decoupling,
  hand-support >1s, weight-shift, both-feet-set, hip >5cm off wall, shoulder-relax), scoped to the
  **occlusion-robust subset** (hip/foot/CoM — _not_ fine hand technique, unreliable from one camera).
  (3) **Out of scope (says why):** general "optimal technique" coaching (unfalsifiable, no ground
  truth) and hold-aware features (per-gym detector generalisation = the XL tail). (4) Optional LLM
  narration is **BC-42**, layered only on the numeric findings — never inventing advice. When a
  milestone schedules this, consider splitting the MVP slice into its own PBI sibling to BC-41/42/43.
- **Design spec drafted (2026-06-13):** [`docs/specs/cv-technique-coach-design.md`](specs/cv-technique-coach-design.md)
  — the design-only deliverable above is now written (scope, on-device MediaPipe decision, pure
  `src/domain/technique.ts` shape, occlusion-robust flag subset, evaluation plan). **Pending PO review;
  still no app code** until a milestone schedules it.
- **Files:** `docs/specs/cv-technique-coach-design.md`

### BC-41 · Health-data import → auto-fill check-in — `open` (design only)

- **Type:** system-design · **Priority:** P3 · **Complexity:** L · **Depends on:** —
- **Vision:** the 30s check-in asks for sleep + fatigue the user often already tracks on a watch/phone.
  Spec a privacy-first import (Apple Health / Google Fit / Health Connect) that pre-fills sleep quality
  (and maybe HRV → readiness, BC-28) so check-in becomes confirm-not-enter.
- **Acceptance criteria:** deliverable is a **design spec only** (`docs/specs/`). Explore: PWA reach vs a
  native bridge (Health APIs are largely native-only — document the honest constraint + a web fallback),
  the privacy default (data stays on device, opt-in per metric), how imported sleep maps onto the 1–5
  `sleepQuality` scale, and whether/how HRV feeds readiness. **No app code** until a future milestone
  schedules it.
- **Files:** `docs/specs/health-import-design.md`

### BC-42 · AI-narrated weekly review — `open` (design only)

- **Type:** system-design/ai · **Priority:** P3 · **Complexity:** L · **Depends on:** BC-07
- **Vision:** the engine already persists `AdaptationLogEntry[]` (BC-07) + load/grade history. Spec an
  opt-in weekly summary that narrates it in the supportive-coach voice ("you deloaded Tuesday after a
  rough night, then flashed your V5 project Friday — base is broadening"). Natural fit for the Vercel AI
  SDK / AI Gateway.
- **Acceptance criteria:** **design spec only** (`docs/specs/`). Explore: local-first vs server inference
  (privacy — the app has never sent data off-device; a cloud LLM breaks that, so document the tradeoff +
  an option-to-disable stance), the prompt shape over the structured log (deterministic data in,
  narration out — the model must **never** invent training advice that bypasses the safety rules engine),
  cost, and the UX of a dismissible weekly card. **No app code / no provider keys** until scheduled.
- **Files:** `docs/specs/ai-weekly-review-design.md`

### BC-43 · Shareable program / progress snapshot — `open` (design only)

- **Type:** system-design · **Priority:** P3 · **Complexity:** M · **Depends on:** BC-10
- **Vision:** the architecture was explicitly "me now, shareable later." Spec a read-only share of a
  program week or a progress snapshot (pyramid + streak + ACWR trend) a climber can send to a friend or
  coach — the first multi-user-adjacent step, reusing BC-10's serialization without the full cloud-sync
  build (BC-18).
- **Acceptance criteria:** **design spec only** (`docs/specs/`). Explore: link-based read-only share vs
  an exported image/card, hosting (static export vs a minimal serverless read endpoint), what's
  shareable without leaking injury/health data (privacy default: progress yes, raw pain logs no), and how
  it relates to BC-18 (sync) so the two don't diverge. **No app code** until scheduled.
- **Files:** `docs/specs/shareable-progress-design.md`

---

## Recommended order (dependency-aware)

The P0→P1 core chain is shipped (Shipped log). Remaining open work, suggested order:

```
Data safety first (cheap, high-leverage):   BC-31 → BC-33 → BC-32 → BC-34
Harness compounding (run anytime, solo):     BC-35 (safety mutation, P1 — do first) · BC-26 · BC-36 (bundle) · BC-37 (a11y) · BC-16 (offline e2e)
Onboarding fidelity (PO feedback, cheap):    BC-44 (VB/V0) · BC-45 (1–7 sessions)  [both touch periodization.ts + bootstrap.ts + profile → run SEQUENTIALLY]
Content depth (PO feedback, foundation 1st): BC-46 → then BC-47 · BC-49 · BC-50 (reuse it) → BC-48 (week variation + clickable program)
Content-fidelity fixes (PO round 2, do next): BC-52 (warm-up/cooldown detail) → BC-54 (shared BlockSummary) · BC-53 (program week differs)  [BC-52/54 + BC-53 both edit program/page.tsx + periodization.ts → run SEQUENTIALLY]
Coach intelligence:                          BC-28 → BC-30 → BC-51 (Insights summary) → BC-27 → BC-29 (BC-29 = safety protocol)
Polish (after BC-14 icons / brand settled):  BC-14 → BC-38 → BC-40 → BC-39 · BC-25 (dark mode)
P3 design specs, when a milestone schedules them: BC-18 · BC-20 · BC-21 · BC-24 · BC-41 · BC-42 · BC-43   (BC-19 absorbed by BC-48)
```

> Good disjoint pairs for parallel Crew runs (no shared `Files:`): **BC-35 + BC-30**,
> **BC-36 + BC-28**, **BC-37 + BC-32**. Once **BC-46** lands, **BC-49** (`drills.ts`/`/drills`) +
> **BC-50** (`offWallExercises.ts`/`/exercises`) are a clean disjoint pair. Anything touching
> `src/app/page.tsx` (BC-27/28/31/34/39/40) must run **sequentially**; likewise everything that edits
> `src/domain/periodization.ts` (BC-44/45/47/48) and `src/app/insights/page.tsx` (BC-30/38/51).

## Shipped log

Done PBIs, condensed from their full bodies (Problem/AC/Files live in git history + `docs/LEARNINGS.md`).
Kept as parseable `### BC-xx … — `done (commit)``headers so the Crew scheduler still resolves`Depends on:`to a done status — **do not collapse these to plain bullets** (guarded by`tests/crew/backlog-hygiene.test.ts`).

> **P0 — core program & engine (the v1 promise)**

### BC-01 · Program week never advances — `done (9f009bd, 2026-06-10)`

### BC-02 · Dates are keyed to UTC, not the user's timezone — `done (9f009bd, 2026-06-10)`

### BC-03 · Rest days don't exist; `availableWeekdays` is ignored — `done (9f009bd, 2026-06-10)`

### BC-04 · Session player captures no climbing data; warm-up auto-completes — `done (9f009bd, 2026-06-10)`

### BC-05 · Progression/regression rules (spec rules 6–7) — `done (9f009bd, 2026-06-10)` · safety-rule-reviewer: PASS

> **P1 — spec'd v1 behavior**

### BC-06 · Onboarding & profile screen — `done (15c1e10, 2026-06-11)`

### BC-07 · Surface the "why": neutral-check-in flag + persisted adaptation log — `done (15c1e10, 2026-06-11)`

### BC-08 · Long-layoff detection and re-ramp — `done (15c1e10, 2026-06-11)`

### BC-09 · Rest timer in the session player — `done (15c1e10, 2026-06-11)`

### BC-10 · Data export / import (backup) — `done (44fe5f0, 2026-06-11)`

> **P2 — polish / infra (first wave)**

### BC-11 · Shared app shell: bottom tab navigation — `done (ad7a4ce, 2026-06-12)` · closed by BC-23

### BC-12 · Honest error/empty states — `done (21f6f7a, 2026-06-11)`

### BC-13 · Severity levels for pain/soreness — `done (d418717, 2026-06-11)`

### BC-15 · Deploy to Vercel (production URL) — `done (badc81f + docs, 2026-06-12)` · live at https://boulder-coach-gamma.vercel.app

### BC-17 · CI speed: cache Playwright browsers — `done (c85d5a6, 2026-06-11)`

### BC-22 · Off-the-wall exercises (antagonist / core / mobility) — `done (2687031, 2026-06-11)`

### BC-23 · Adopt the Boulder Coach Design System (bright & playful brand skin) — `done (ad7a4ce, 2026-06-12)` · also closed BC-11
