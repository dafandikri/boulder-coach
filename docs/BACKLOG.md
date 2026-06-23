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
  `pnpm lighthouse`, new `lighthouse` CI job) with category budgets (originally perf ≥ 0.80, a11y ≥ 0.90,
  BP ≥ 0.90, SEO ≥ 0.95 — buffered below the deployed 87/96/100/100 for the localhost-only Vercel-script
  404s; **ratcheted 2026-06-14 PR #44 to perf ≥ 0.85, a11y ≥ 0.95, BP ≥ 0.95** — see README for current).

- **Type:** ci/test · **Priority:** P2 · **Complexity:** M
- **Problem:** service-worker runtime behavior is the biggest acknowledged gate-blind risk —
  guarded today only by a string-content test. Offline shell load and manifest installability can
  regress silently.
- **Acceptance criteria:** a Playwright (or Lighthouse-CI) job asserts: SW registers, page loads
  offline after first visit, manifest passes installability audit. Runs in CI on the production
  build. This promotes the HANDOFF's top gate-blind risk to Tier-1.
- **Files:** `e2e/`, `.github/workflows/ci.yml`, possibly `playwright.config.ts`.

### BC-25 · Dark mode (token theme + toggle) — `done`

- **Shipped:** a full **"gym at night"** dark theme authored by the Boulder Coach Design System
  (delivered as `tokens/colors.css`, brand-owner contrast pass done — every fg/bg pair WCAG-AA, e.g.
  `--text` 15.5:1 on `--bg`, white-on-`--brand` 4.6:1). It layers over BC-23's variables under
  `:root[data-theme='dark']`, overriding both the **raw ramps** (`chalk-*`/`basalt-*` — read directly
  by tracks/grooves/the ink outline) and the **semantic aliases**: on dark, `--basalt-900` flips from
  dark ink to a warm chalk outline, `--pop-shadow` decouples to a true dark offset (the sticker "pop"
  reads as depth, not a hole), the `-deep` tones become the LIGHT foreground and the `-tint` tones
  become DARK callout surfaces. A token-driven dark body field keeps the two subtle hold-glows.
  - **Decision logic in a covered layer (`src/app/lib/theme.ts`, 100%):** `resolveTheme` (explicit
    stored choice wins, else `prefers-color-scheme`), `nextTheme`, `isTheme`, and `applyTheme` (DOM via
    a structural `ThemeRoot` seam so it's unit-tested). `layout.tsx` runs the same logic in a tiny
    **no-flash inline `<script>`** (first in `<body>`, sets `data-theme` + `color-scheme` before paint).
  - **Toggle:** gate-blind `src/app/components/ThemeToggle.tsx` (Settings → **Appearance**) reads the
    initial state via a lazy SSR-safe `useState` initialiser (no effect `setState` — Next 16's
    `react-hooks/set-state-in-effect`, the BC-39/BC-20 trap) and only does DOM/storage I/O. New `sun`
    icon added to `Icon.tsx`.
  - **Verified** in a real prod build (Playwright): light + dark render correctly app-wide, the toggle
    flips live (`data-theme`/`color-scheme`/localStorage) with correct `aria-pressed`. The CI a11y scan
    runs in the default light scheme, so the BC-37 baseline is untouched. `pnpm gate` green (bundle 167.8 KB).
- **Type:** ux/design · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-23
- **Problem:** the delivered design system ships **light** chalk/basalt tokens only. A real dark theme
  still matters for an "installable PWA you open at the gym" in low light.
- **Acceptance criteria:** a dark token set layered over BC-23's CSS variables (chalk→deep basalt
  surfaces, ink→chalk text, holds re-tuned for contrast); a toggle persisted locally that respects
  `prefers-color-scheme` on first load; theme/toggle logic in a covered `src/app/lib/theme.ts`, not
  scattered across components; **no gate regression**. Coordinate hold-color contrast with the brand
  owner before shipping.
- **Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/lib/theme.ts`,
  `src/app/components/ThemeToggle.tsx`, `src/app/components/Icon.tsx`, `src/app/profile/page.tsx`

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

### BC-38 · Insights data visualizations (trends over time) — `done (PR #53)`

- **Shipped:** three pure, `asOf`-windowed series-builders in `src/domain/insights.ts` —
  `loadSeries` (daily sRPE × min, oldest→newest, empty-safe), `acwrSeries` (daily EWMA-ACWR by running
  the already-tested `computeLoadMetrics` per day — no ACWR re-implementation, so the safety math stays
  in the one 100%-covered/mutation-tested file), and `sorenessFrequency` (per-body-part flag counts,
  desc, tie-broken alphabetically). New presentational `src/app/components/Sparkline.tsx` (inline SVG,
  no charting dep — bundle held at 167.8/200 KB) is `role="img"` with a word-trend `aria-label` (BC-37:
  not colour-only). Insights renders a "Load & ACWR trend" card (ACWR sparkline shades the healthy
  0.8–1.3 band) + a "Soreness by body part" frequency card; all logic in the covered domain, the page
  only renders. TDD: 10 new tests cover windowing, same-day summing, future/old exclusion,
  engine-consistency, and tie-breaks. `pnpm gate` green.
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

### BC-39 · Custom add-to-home-screen install prompt — `done`

- **Shipped:** pure `src/app/lib/install.ts` — `decideInstallPrompt({ standalone, hasNativePrompt, ios,
dismissed, engaged }) → 'native' | 'ios-hint' | 'hidden'` with precedence: never invite an
  already-installed (`isStandalone`, covering `display-mode: standalone` + iOS `navigator.standalone`),
  dismissed, or not-yet-`engaged` app, then prefer the captured Chromium prompt, else the iOS
  (`isIOS(ua, maxTouchPoints)` — also catches iPadOS 13+ iPads that report a desktop Macintosh UA)
  manual Share-sheet hint. Today captures `beforeinstallprompt` (suppressing the default
  banner) in an effect, gates `engaged` on having logged ≥1 session (never nags on first paint), and
  renders the CTA in a brand `Callout` — the native variant fires `event.prompt()` then persists
  `INSTALL_DISMISS_KEY` **only when the user declines** (an accepted-but-failed install can re-fire);
  the iOS variant shows the Share hint. The decision is derived
  during render from an SSR-safe lazy-read env (no effect-driven setState — satisfies the Next 16
  `react-hooks/set-state-in-effect` rule). TDD: `tests/app/install.test.ts` (14) covers
  standalone/iOS/dismissed/not-engaged/native/desktop branches; `install.ts` 100%. `pnpm gate` green.
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

### BC-20 · Training-day reminders — `done (PR #54)`

- **Shipped:** opt-in local notifications nudging a check-in on training-day mornings. Pure
  `src/app/lib/reminders.ts` (covered) — `shouldRemindOnOpen()` fires only when opted-in, permission
  granted, it's a training-day morning, and not already nudged today; `reminderContent()` gives
  per-session copy ("Limit day today 🔥 — check in first."). Profile has an opt-in toggle that requests
  Notification permission + persists the choice (lazy SSR-safe read — no effect `setState`, per Next 16's
  `react-hooks/set-state-in-effect`, matching BC-39). Today fires the nudge on open via the covered
  decision, stamping the date only when it actually shows. **Honest limitation (documented in
  `reminders.ts`):** a backendless local-first PWA can't OS-schedule a push, so it nudges on app-open in
  the morning rather than at a fixed time — a future Periodic Background Sync / push-server upgrade could
  make it time-scheduled. TDD: `tests/app/reminders.test.ts` (9) cover every decision branch + per-type
  content. `pnpm gate` green.
- **⚠️ Known gap (PO-flagged 2026-06-15) → see BC-58:** the on-open mechanism is a logical
  contradiction — a reminder should pull the user back when they're _not_ in the app; firing it only
  _after_ they open the app delivers ~none of the intended value. BC-58 designs the real fix (Web Push
  - Vercel Cron + SW-decides). BC-20 stays `done` for the toggle/copy/decision groundwork it shipped.
- **Type:** feature · **Complexity:** M
- Local notifications (PWA Notification + service worker) on `availableWeekdays` mornings:
  "Limit day today — check in first." Depends on BC-03 (real schedule) and BC-15 (HTTPS origin).
- **Files:** `src/app/lib/reminders.ts`, `src/app/page.tsx`, `src/app/profile/page.tsx`

### BC-58 · Reminders that fire when the app is CLOSED (BC-20's core value is missing) — `open` (**design spec drafted 2026-06-16**)

- **Type:** feature/system-design · **Priority:** P2 · **Complexity:** L · **Depends on:** BC-20
- **Design spec drafted (2026-06-16):** [`docs/specs/reminders-push-design.md`](specs/reminders-push-design.md)
  — the spec-first deliverable below is written. Grounded in current `web-push`/Vercel-Cron docs
  (Context7). Key decisions: **content-less wake push + SW-decides from on-device IndexedDB** (schedule
  never leaves the device; server stores only an opaque, pseudonymous push subscription in **Upstash Redis**
  via the Vercel Marketplace); a single **audience-tuned daily cron** (~23:00 UTC ≈ 06:00 WIB) covers the
  Indonesian primary audience on Hobby, with multi-fire global coverage as a documented Pro/external-cron
  scale path (a push only shows when it _arrives_ — the SW can't defer it, so morning coverage is a
  timezone/cron problem). Honest limitations recorded: the `userVisibleOnly` silent-push budget, iOS 16.4+
  installed-PWA-only, and the env-var/backend trade-off vs the no-backend posture. Pure decision predicates
  (`buildReminderPlan`/`pickReminderForDay` in `src/domain/reminderSchedule.ts`) keep the logic out of the
  gate-blind `sw.js` (a drift guard asserts the SW copy ≡ the tested module). Implementation is sliced
  (pure core → store+API+cron → client+SW) so each slice is gate-green. **Pending PO review; no app code
  until a milestone schedules it.**
- **PO demand (2026-06-16):** product owner explicitly wants reminders to **actually work on iOS,
  Android, and everything** — escalated from design-first P3 to buildable P2. iOS works only for an
  **installed** PWA (16.4+), which is exactly the owner's add-to-home-screen case (see also BC-61).
- **Problem (PO-flagged 2026-06-15):** BC-20 only nudges _on app-open_, which is backwards — a
  reminder's entire purpose is to pull the user back when they're **not** in the app. If they already
  opened it, they didn't need reminding. As shipped, the feature delivers ~none of its intended value;
  it's a toggle + copy with no real trigger.
- **The real mechanism (and why it fits this stack):** a backendless PWA genuinely can't OS-schedule a
  notification, but a _minimal_ serverless cron can — the app already runs on Vercel. Proposed design:
  **Web Push (VAPID) + a Vercel Cron** firing a daily "wake" push; the **service worker** reads the
  local schedule (IndexedDB) and decides whether to show the training-day notification — so the schedule
  stays on-device and the server only sends a dumb daily ping (no personal data server-side). Record the
  dead ends so nobody retries them: **Notification Triggers API** (never standardized / removed) and
  **Periodic Background Sync** (Chromium-only, unreliable, no iOS). iOS caveat: Web Push works only for
  **installed** PWAs (iOS 16.4+).
- **Acceptance criteria (spec → build):**
  - Design spec first (`docs/specs/reminders-push-design.md`): push-subscription storage (minimal),
    VAPID key handling, the cron→push→SW-decides flow, the iOS installed-PWA constraint, and the
    backend trade-off vs BC-20's on-open nudge.
  - Then implement: a Vercel Cron route fires a daily "wake" push (VAPID); the **service worker**
    reads the on-device schedule (IndexedDB) and decides whether to show the training-day
    notification — **no personal schedule data leaves the device**, the server only sends a dumb ping.
  - Subscribe/unsubscribe is wired into the existing reminders opt-in (`src/app/lib/reminders.ts` +
    profile toggle); push subscription persists and survives reload.
  - Decision logic lives in covered layers (`src/app/lib/**` / `src/domain/**`) with TDD — the
    SW-decides predicate (training-day? already-shown-today?) is unit-tested, not buried in `sw.js`.
  - e2e/manual: an installed PWA on iOS 16.4+ and Android Chrome receives a training-day notification
    while the app is closed. Record the dead ends (Notification Triggers API, Periodic Background Sync).
- **Files:** `docs/specs/reminders-push-design.md`, `src/app/lib/reminders.ts`,
  `src/app/api/push/route.ts` (new), `public/sw.js`, `src/app/profile/page.tsx`

### BC-59 · Streak/progress counts a rolling 7-day window, not a program week (shows 2/3 at week start) — `done`

- **Shipped:** `computeConsistency` now anchors weeks to the **program week** —
  `floor((day − startDate) / 7)`, the exact bucket `programPosition` derives — instead of a rolling
  7-day window ending `asOf`. The signature gained the program `startDate`; bootstrap passes
  `program.startDate`. At the first moment of a new program week `weekDoneCount === 0` even if the
  prior week was full (no more dragging the tail forward), and the streak counts consecutive
  **completed program weeks** down to week 0 — a full prior week → next week opens `0/3` with the
  streak intact, and the in-progress week still joins only once it meets target (never breaks it).
  The walk is bounded by `week >= 0` so a degenerate target ≤ 0 still terminates. All logic stayed in
  `src/domain/consistency.ts`; the page only renders. TDD: `consistency.test.ts` (10) reproduces the
  open-at-0-not-2/3 symptom across a week boundary + keeps the in-progress / multi-week / break
  invariants. `adaptation.ts`/`loadMetrics.ts` untouched. `pnpm gate` green (bundle 167.8 KB).
- **Type:** bug · **Priority:** P2 · **Complexity:** M
- **Problem (user-reported 2026-06-16):** after a climber hits their weekly target (e.g. 3/3) and earns
  a 1-week streak, the **next** week opens showing `2/3` instead of `0/3`. Root cause: `computeConsistency`
  (`src/domain/consistency.ts:42`) counts sessions in a **rolling 7-day window ending `asOf`**
  (`countInWeek(0)`), which never resets on a week boundary — so sessions logged 3–6 days ago (the tail of
  the previous week) still count toward the new week. The streak walk (`offset` loop) inherits the same
  drift. The doc comment calls the rolling window intentional, but it contradicts the user's mental model
  of a week that resets.
- **Decision (PO, 2026-06-16):** anchor weeks to the **program week** — `floor((sessionDay − startDate)/7)`,
  the same bucket `programPosition` already derives (`src/domain/programClock.ts`, `daysSinceStart/7`). Not
  calendar weeks, not rolling. This reuses the existing program clock so a week boundary is exactly a
  program-week boundary; the in-progress week still joins the streak only once it meets target and never
  breaks it mid-week (preserve the current invariant).
- **Acceptance criteria:**
  - `computeConsistency` buckets sessions by program week anchored on `startDate` (signature gains the
    program start anchor; today it only takes `logs, profile, asOf`). At the first moment of a new program
    week, `weekDoneCount === 0` even if the prior week was full.
  - The streak counts **consecutive completed program weeks**; a full prior week → next week opens at
    `0/3` with streak intact, and the streak only increments once a week actually completes target.
  - Logic stays in `src/domain/**` (it already does) — **no** counting logic added to `page.tsx`.
  - TDD: a failing test first that reproduces the `2/3`-at-week-start symptom across a week boundary, plus
    the existing invariants (in-progress week never inflates/breaks). `adaptation.ts`/`loadMetrics.ts`
    untouched, so no safety-reviewer needed; `consistency.ts` holds ≥ 92% branch.
- **Files:** `src/domain/consistency.ts`, `tests/domain/consistency.test.ts`, `src/app/page.tsx`

### BC-60 · "Sets completed" number field can't be cleared and shows leading zero (`08`) — `done`

- **Shipped:** pure `src/app/lib/sessionInput.ts` — `sanitizeCountInput` (display while editing:
  digits-only, drops leading zeros so "08" → "8" and the stuck "0" deletes to "") + `normalizeCount`
  (stored value: empty → 0, clamped to `SETS_MIN`/`SETS_MAX` = 0/20; negatives clamp to the floor). The
  session player now binds the field to a raw `setsRaw` display string (`type="text" inputMode="numeric"`)
  so it can be momentarily empty, syncs the stored count live, and snaps the display back to the
  normalized count on blur ("outside the field it's 0"). All parse/clamp logic left the gate-blind page.
  TDD: `tests/app/sessionInput.test.ts` (13) covers `''`/`'0'`/`'08'`/`'8'`/`'25'`(clamp)/negative for
  both helpers. `pnpm gate` green (bundle 167.8 KB).
- **Type:** bug · **Priority:** P2 · **Complexity:** S
- **Problem (user-reported 2026-06-16):** the "Sets completed" input in the session player can't be
  emptied — deleting the value leaves a `0` that can't be removed, and typing `8` over it yields `08`.
  Root cause: `value={entry.setsCompleted}` is a `number` so the field can never hold `""`, and
  `onChange` does `Math.max(0, Number(e.target.value))` (`src/app/session/page.tsx:322-329`), where
  `Number('')` collapses "empty" into `0`. The coercion also lives inline in gate-blind `page.tsx`.
- **Acceptance criteria:**
  - The field can be cleared to empty while editing (no stuck `0`, no leading-zero `08`); typing `8`
    shows `8`.
  - An empty/blank field normalizes to `0` on blur (or on save) — "outside the field it's 0", per the
    user — and values stay clamped to the existing `min 0 / max 20`.
  - The parse/normalize/clamp logic moves into a **covered helper** (`src/app/lib/**`, e.g. a
    `normalizeCount`/`parseSetsInput`), not inline in `page.tsx` (logic-in-covered-layers rule). The
    component holds the raw string for display and calls the helper.
  - TDD: failing test first on the helper for `''`, `'0'`, `'08'`, `'8'`, `'25'` (clamp), negative input;
    helper ≥ 95% branch.
- **Files:** `src/app/lib/sessionInput.ts` (new), `tests/app/sessionInput.test.ts` (new), `src/app/session/page.tsx`

### BC-61 · Installed iOS PWA: bottom nav crowds the home indicator (missing `viewport-fit=cover`) — `done`

- **Shipped:** added a Next 16 `viewport` export to `src/app/layout.tsx`
  (`viewportFit: 'cover'` + explicit `width: 'device-width'`/`initialScale: 1`), so iOS stops
  reporting `env(safe-area-inset-*)` as 0 and BottomNav's existing
  `calc(10px + env(safe-area-inset-bottom))` padding lifts the tab bar clear of the home indicator.
  Enabling `cover` also activates the TOP inset, so the mobile column now pads
  `env(safe-area-inset-top)` to keep content clear of the status bar/notch in standalone mode.
  **Tier-1 guard:** `tests/pwa/manifest.test.ts` asserts the `viewport` export sets
  `viewportFit: 'cover'` (source-text check, like the sibling `sw.js` guards) so a future edit
  can't silently drop it. `pnpm gate` green (bundle 167.8 KB).
- **Type:** bug · **Priority:** P2 · **Complexity:** S
- **Problem (user-reported 2026-06-16):** added to the iOS home screen, the bottom tab bar sits right
  against the iPhone home indicator / gesture bar. Root cause: `BottomNav.tsx:37` already pads with
  `calc(10px + env(safe-area-inset-bottom))`, but iOS reports `env(safe-area-inset-*)` as **0** unless
  the viewport declares `viewport-fit=cover`. `src/app/layout.tsx` has **no `viewport` export**, so Next
  injects only its default viewport (no `viewport-fit=cover`) and the inset collapses to 0.
- **Acceptance criteria:**
  - Add a Next 16 `viewport` export in `src/app/layout.tsx` with `viewportFit: 'cover'` (alongside the
    existing default width/scale). The bottom nav's existing `env(safe-area-inset-bottom)` padding then
    lifts tap targets clear of the home indicator on an installed iOS PWA.
  - Enabling `cover` also activates the **top** inset — ensure the app shell doesn't slide under the
    status bar/notch: apply `env(safe-area-inset-top)` padding to the top of the mobile column
    (`layout.tsx` wrapper) so content stays clear in standalone mode.
  - **Tier-1 guard:** extend `tests/pwa/manifest.test.ts` (or a sibling viewport test) to assert the
    `viewport` export sets `viewportFit: 'cover'`, so a future edit can't silently drop it.
- **Files:** `src/app/layout.tsx`, `src/app/components/BottomNav.tsx`, `tests/pwa/manifest.test.ts`

### BC-62 · Consolidate the content catalog into `src/domain/content/` + Tier-1 content-validation gate — `open`

- **Type:** infra/refactor · **Priority:** P2 · **Complexity:** M
- **Problem (PO-raised 2026-06-16):** all instructional content is hardcoded as typed TS literal
  arrays mixed into the domain _logic_ files — `DRILLS` (`drills.ts`), `OFF_WALL_EXERCISES`
  (`offWallExercises.ts`), warmup blocks (`warmup.ts`), technique drills (`periodization.ts`). It's
  pure + typed (good), but (a) there's no single "here's where content lives" home, and (b) nothing
  validates a new entry. **Concrete gap proving (b):** several drills reference `imageId`s
  (`deadpoint`, `smear`, `ecu-pronation`, `tendon-glide`, `pushup`) that have **no matching SVG** in
  `public/exercises/` — the cards silently fall back to the placeholder and no gate catches it.
- **Goal:** make adding drills/exercises _easy and safe_ — additive data edits in one place, with the
  gate catching malformed/duplicate/broken-image entries by filename.
- **Acceptance criteria:**
  - Move the catalogs (drills, off-wall, warmup data, technique drills) into a dedicated
    `src/domain/content/` subfolder — **inside** domain so it stays pure and importable by
    `periodization.ts` (a top-level `src/content/` would force a domain→content edge that violates
    `domain-stays-pure`). Keep them as **typed TS** (not JSON) to preserve compile-time shape safety;
    `ExerciseContent`/`Drill`/`OffWallExercise` types stay the contract. Update importers' paths.
  - **Tier-1 validation test** (`tests/domain/content-catalog.test.ts`): unique `id`s across each
    catalog; non-empty `steps`/`cues`/`commonMistakes`; valid `category`/`purpose`; `dosage` present
    for prehab + off-wall; and **every referenced `imageId` resolves to a real file in
    `public/exercises/`** (or is omitted). A malformed/duplicate/missing-image entry fails the gate.
  - Authoring guide `skills/authoring-content.md` (+ `skills/README.md` index entry): the one
    documented way to add a drill/exercise, referenced from the content folder.
  - Behavior-preserving: same content renders identically; `pnpm gate` green; coverage unaffected
    (data has no branches; the validator test is the new covered logic).
- **Out of scope / future direction (noted, not now — YAGNI):**
  - **Motion media (PO-raised 2026-06-16):** today an `imageId` is a single hand-authored **static
    SVG** diagram (`public/exercises/<id>.svg`, 320×200). Technique drills are about _motion_, so a
    short gif/MP4/Lottie would teach better — but it's heavier (bundle-size / Lighthouse / offline
    budgets) and the convention assumes one SVG per `imageId`. A future enhancement could let an
    exercise carry an optional motion asset alongside the SVG poster; decide format + budget first.
  - Remote/CMS-driven content behind an `IContentSource` seam (only if non-deploy content edits are
    ever wanted).
  - The 5 missing SVGs found above (`deadpoint`, `smear`, `ecu-pronation`, `tendon-glide`, `pushup`)
    can be drawn in a separate content task.
  - Structured content also unblocks **BC-55** (i18n) by making the translatable surface explicit.
- **Files:** `src/domain/drills.ts`, `src/domain/offWallExercises.ts`, `src/domain/warmup.ts`,
  `src/domain/periodization.ts`, `tests/domain/content-catalog.test.ts`, `skills/authoring-content.md`,
  `skills/README.md`

> **Backlog extended 2026-06-16 (Claude Opus 4.8, PO end-to-end diagnosis):** BC-63 + BC-64 added —
> two gaps **created by the seams between already-`done` PBIs**, each traced to an exact line, not
> assumed. (1) BC-44/45 made **beginners** a supported audience (VB/V0, 1–7×) but the periodization
> engine was never taught to program for them, so a VB climber still gets a V6's RPE-9 limit day — a
> coaching **and** injury-safety defect. (2) BC-04's session player became the **only** `SessionLog`
> writer, so off-plan/rest-day/other-gym climbing is uncapturable — silently starving ACWR, the streak,
> and Insights of real load (and weakening the deload-safety math, which underestimates risk on partial
> data). Both are verified against the code below.

### BC-63 · Beginner-aware program content — a VB/V0 climber still gets a V6's RPE-9 limit day — `done`

- **Shipped (2026-06-23):** new pure `gradeBand(currentGrade) → 'beginner' | 'intermediate'` in
  `grade.ts` (beginner = `currentGrade ≤ 2`, i.e. VB/V0/V1/V2). `generateProgram` derives the band once
  and `sessionPlanFor` is now band-aware: a beginner's week is built **only** from the existing,
  unchanged low-intensity session types (`volume-technique` RPE 6 + `antagonist-prehab` RPE 6) — **never**
  `limit-boulder` (RPE 9) or the `power-endurance` 4×4 (RPE 8), the A2/PIP injury vectors. **The fix is
  rotation-only:** the blocks those safe types produce are byte-identical, so a beginner's per-block
  intensity is never above the grade-agnostic equivalent — **additive-safety holds under every reading**
  (we removed the two hard days and raised nothing), keeping the change out of
  `adaptation.ts`/`loadMetrics.ts` (no safety-reviewer needed). Intermediate (V3+) output is byte-identical
  (`mainBlocksFor`/`buildSession` untouched). A `weekSummary` build-week line was made band-neutral so it
  no longer claims a beginner does "limit, power-endurance and technique". **TDD** + a code-review agent
  (two passes — it caught an earlier RPE-7 design that broke additive-safety under the per-session-type
  reading; redesigned to rotation-only). Tests: `gradeBand` boundary (V2 vs V3); a frequency **sweep
  1..7** × every beginner grade asserting no limit/4×4 type or `main-limit`/`main-4x4` block; RPE ≤ 6
  across all blocks/phases; both deload weeks + the peak week kept easy; intermediate-byte-identical
  regression. `periodization.ts` ≥ 92% branch; `pnpm gate` green.
- **Type:** feature/safety · **Priority:** P2 (high) · **Complexity:** M · **Depends on:** BC-44, BC-45
- **Problem (PO-diagnosed 2026-06-16, verified against code):** BC-44 lowered the onboarding floor to
  **VB/V0** and BC-45 opened frequency to **1–7×**, but the program engine never learned to _coach_ a
  beginner. `sessionPlanFor` (`periodization.ts:94`) and `mainBlocksFor` (`periodization.ts:202`) are
  **structurally grade-agnostic** — a VB climber gets the **identical** rotation as a V6: a
  **`limit-boulder`** day at **`targetRPE: 9`** ("a problem at your absolute limit", `mainContentFor`
  ~line 116) and a **`4×4 power-endurance`** day. (Even the session player's `gradeChoices` defaults to
  V4 — `session/page.tsx:68`.) This is **miscoaching** — a true beginner needs easy-mileage volume +
  movement technique, not max-effort limit work or power-endurance intervals — **and** an **injury
  vector**: RPE-9 limit bouldering on undeveloped tendons/skin/pulleys is precisely the A2/PIP risk the
  app's core promise ("keeps you out of injury") exists to prevent. The spec scoped v1 to intermediate
  V4–V6 (§Goal), so this gap was _created_ the moment BC-44 made beginners a supported audience without
  extending the engine.
- **Value:** the largest under-served segment BC-44 deliberately onboarded (true beginners) finally gets
  a _credible, safe_ program instead of an intermediate's plan that could hurt them — closing the
  onboarding promise the app now makes to them.
- **Acceptance criteria:**
  - A pure `gradeBand(currentGrade) → 'beginner' | 'intermediate'` (e.g. beginner = `currentGrade ≤ 2`,
    i.e. VB/V0/V1/V2) in `periodization.ts` (or `grade.ts`), tested at the boundary.
  - For the **beginner** band, `sessionPlanFor`/`mainBlocksFor` produce a beginner-appropriate plan:
    **no max-effort `limit-boulder` (RPE 9) and no `4×4 power-endurance` day**; the week skews to
    volume-technique + simple antagonist-prehab, and the one "try-hard" stimulus is a sub-limit
    _projecting_ block at a **capped RPE (≤ 7)**, not RPE 9. Frequency guidance (BC-45) still applies.
  - **Additive-safety invariant (the safety dimension, tested):** for any profile, a **beginner**
    program's per-block intensity (`targetRPE`) and max-effort exposure is **≤** what the current
    grade-agnostic code produces — beginner content may only _lower_ intensity/volume, never raise it.
    This keeps the change **out of** `adaptation.ts`/`loadMetrics.ts` (no safety-reviewer gate needed),
    mirroring BC-29's injury-baseline contract.
  - **Intermediate band unchanged (regression test):** a V5 profile's generated program is
    byte-identical to today's output — no behavior change for the spec's original audience.
  - Tested: a VB and a V0 profile **never** produce a block with `targetRPE > 7` or a
    `limit-boulder`/`power-endurance` main; a V3+ profile still does; the band boundary (V2 vs V3) is
    asserted. `periodization.ts` holds ≥ 92% branch.
- **Files:** `src/domain/periodization.ts`, `src/domain/grade.ts`, `tests/domain/periodization.test.ts`
- **Sequencing:** edits `periodization.ts`, which **BC-62** also moves/edits — run **sequentially** with
  BC-62 (ideally after BC-62's content move lands), never as a parallel Crew pair.

### BC-64 · Freeform / quick session logging — off-plan climbing never gets captured — `done`

- **Shipped:** a **"Log a session"** entry point on the Today **rest-day** card and on **/history** opens a
  new lightweight `/log` page (date default today, duration, session-RPE slider, optional sends, optional
  note) — no planned session required. All decision logic lives in the covered, pure
  `src/app/lib/quickLog.ts` (`validateQuickLog`, `freeformLogId`, `buildQuickLogInput`); the page only does
  repo I/O. A freeform log writes through the same `IClimbRepo.saveLog` path, so `loadMetrics` (ACWR),
  `computeConsistency` (streak), and Insights pick it up with **no engine change** (verified by an
  integration test that drives both engines). **Fixed the verified log-id collision:** `createSessionLog`
  keyed `id` as `log-<date>`, so a second log on a day would overwrite the first; `SessionLogInput` now
  takes an optional `id` — the planned player still omits it (stays `log-<date>`, idempotent), and
  `freeformLogId` hands freeform logs a unique `log-<date>-q<n>` that never collides with the planned id.
  Sends are recorded as attempts too (every send is an attempt — BC-65 invariant). `/log` added to the
  axe a11y route sweep. TDD: `tests/app/quickLog.test.ts` (10, helper ≥95% branch) + extended
  `sessionLog.test.ts` (id default vs. override). `pnpm gate` green (bundle 167.8 KB).
- **Type:** feature · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-04, BC-10
- **Problem (PO-diagnosed 2026-06-16, verified against code):** the **only** writer of a `SessionLog` is
  the planned-session player — `/session` loads today's _planned_ session via `getTodaySession` and
  saves through `createSessionLog` (`session/page.tsx`). `/history` is **read-only** (`history/page.tsx`
  only calls `getLogs()`), and `BottomNav` has **no "log" affordance**. So a climber who trains
  **off-plan** — an extra session, climbing on a scheduled **rest day** (Today only offers "See mobility
  & prehab"), a quick gym drop-in, or a session at another gym — **cannot record it**. Every such
  session is invisible to the engine: `computeLoadMetrics` (ACWR), `computeConsistency` (streak /
  this-week), and Insights all **silently undercount real training load**. This is not just a logbook
  gap — **ACWR computed on partial load underestimates injury risk**, weakening the deload-safety
  guarantee the app sells, and the streak/insights read dishonestly (a climber who trained 4× sees
  "2/3"). The data model **already supports** a planned-session-less log (`SessionLog.plannedSessionId?`
  is optional; `createSessionLog` passes it through), so only the **write path + UI** are missing.
- **Value:** every real session counts → adaptation, ACWR-safety, streak, and Insights reflect what the
  climber actually did; "I just climbed, let me log it" becomes a 15-second capture instead of an
  impossibility — a retention + data-quality win that compounds across every downstream feature.
- **Acceptance criteria:**
  - A **"Log a session"** entry point reachable from **Today** (especially the **rest-day** card) and
    **/history** opens a lightweight freeform log: date (default today), duration, session RPE (reuse the
    RPE scale UI), optional grades sent, optional note. No planned session required.
  - It writes through the same `IClimbRepo` path so `loadMetrics`/`consistency`/`insights` pick it up
    with **no engine change**; the freeform log round-trips through backup (BC-10) and passes the BC-32
    integrity validator.
  - **Fix the log-id collision (verified latent bug):** `createSessionLog` keys `id` as
    **`` `log-${date}` ``** (`sessionLog.ts:36`), so a freeform log on a day that also has a
    planned-session log would **overwrite** it. The id scheme must disambiguate **multiple logs per local
    day** (e.g. append a counter/uuid) without breaking existing single-per-day logs or the BC-32
    integrity/migration path.
  - Parse/normalize/validate logic lives in a **covered helper** (`src/app/lib/quickLog.ts`), not inline
    in the gate-blind page (logic-in-covered-layers); the page only does I/O.
  - Tested: a freeform log (no `plannedSessionId`) is valid, contributes to ACWR/consistency/Insights,
    survives backup export→import, and two logs on the same date coexist (no overwrite). Helper ≥ 95%
    branch.
- **Files:** `src/app/lib/quickLog.ts` (new), `src/app/log/page.tsx` (new), `src/app/history/page.tsx`,
  `src/app/page.tsx`, `src/domain/sessionLog.ts`, `tests/app/quickLog.test.ts` (new)
- **Sequencing:** edits `src/app/page.tsx` (Today), so it must run **sequentially** with other
  `page.tsx`-touching PBIs (BC-59); also edits `sessionLog.ts` (the id fix).

### BC-65 · Attempts/sends logging — enforce `sends ≤ attempts` + explain what they mean — `done`

- **Type:** bug/ux · **Priority:** P2 (high) · **Complexity:** M · **Depends on:** BC-04
- **Problem (PO + user-reported 2026-06-16, verified against code):** the session player tallies
  **attempts** and **sends** per grade as **two fully independent counters** with no relationship between
  them, and **nothing in the app explains what either word means** — so the data is both _enterable wrong_
  and _understood by nobody_. Concretely:
  1. **`sends > attempts` is freely enterable (the headline logical error).** `adjustTally`
     (`session/page.tsx:178-188`) increments `attempts[grade]` and `sends[grade]` separately, each clamped
     only by `Math.max(0, …)`. There is **no invariant** that `sends[g] ≤ attempts[g]`. A climber can log
     **0 attempts and 5 sends** at V6. In bouldering a **send is a successful attempt** — every send _is_
     an attempt, so `sends > attempts` is physically impossible, yet the UI allows it.
  2. **No validation at any layer.** `expandTally` (`sessionForm.ts:17`) just expands counts;
     `createSessionLog` (`sessionLog.ts:27`) does no semantic check; `validateLog` (`integrity.ts:28`)
     explicitly only guards top-level shape ("_Block-level contents are not deep-validated_"). So a log
     with `gradesSent` that has no matching `gradesAttempted` passes straight through to storage and
     analytics.
  3. **The corruption is safety-adjacent, not cosmetic.** `gradesSent` feeds (a) Insights' `gradePyramid`
     (an inflatable pyramid) and (b) **BC-27's `assessBenchmark`** — which measures a level-up from "the
     highest grade _sent_ in ≥2 sessions" and, on accept, **re-anchors `currentGrade` and rescales the
     whole program's training load**. A few stray "send" taps with no real attempts can
     **phantom-level-up** a climber so the engine prescribes load for a grade they can't actually climb —
     degrading the injury-prevention promise through a data-entry slip.
  4. **Zero explanation in the UI (the user's own confusion).** The two columns are bare lowercase
     `attempts` / `sends` headers (`session/page.tsx:349-350`) with no definition, tooltip, or example.
     ACWR and RPE each got a tap-to-open `MetricExplainer` "(i)" modal; attempts/sends got **nothing**.
     The product owner says plainly "I don't understand it too" — and a beginner (BC-44) or the
     Indonesian-first audience (BC-55) has no way to learn the attempt↔send relationship, which is _why_
     the inconsistent data gets entered in the first place.
  - **Secondary ambiguity to resolve while here:** "attempt" is itself undefined — total goes (incl. the
    successful one) vs failed-only. Pick the standard convention (**attempts = all goes; a flash = 1
    attempt / 1 send; sends ⊆ attempts**) and make both the UI and the copy reflect it.
- **Value:** the logbook becomes **trustworthy** — the pyramid, the BC-27 level-up, and every send-based
  insight reflect real climbing — and the climber finally **understands what they're logging**, so they
  enter it correctly. Fixes a credibility _and_ safety-adjacent defect with one change.
- **Acceptance criteria:**
  - **Enforce the invariant at the domain boundary (covers every writer, incl. BC-64):** a pure helper
    (e.g. `clampSendsToAttempts` in `sessionForm.ts`, or normalisation inside `createSessionLog`) so a
    persisted log can **never** have `sends[g] > attempts[g]`. Choose the model: **a send implies an
    attempt** — recording a send ensures at least that many attempts at the grade.
  - **Make it unreachable in the UI, live:** in the stepper interaction, **+1 send** auto-ensures
    `attempts[g] ≥ sends[g]` (bump an attempt if needed), and **−1 attempt** cannot drop `attempts[g]`
    below `sends[g]` (clamps). The climber sees a coupled, sensible counter — never a contradictory state.
  - **Repair, don't just quarantine, legacy/imported data:** a corrupt `sends > attempts` log read back
    is **sanitised** (sends clamped to attempts) rather than dropped — it's recoverable, unlike the
    NaN-shape cases BC-32 quarantines. So `assessBenchmark`/`gradePyramid` only ever see valid data.
  - **Explain it in-app:** add an attempt/send explainer via the existing `MetricExplainer` pattern (an
    "(i)" by the attempts/sends header) with plain-language copy in a covered `explainers.ts` entry, e.g.
    _"An **attempt** is one go at a problem. A **send** is a go you finished clean (topped out). Every
    send is also an attempt — a flash is 1 attempt, 1 send. Tally all your goes as attempts and mark the
    ones you topped as sends."_ (Authored to translate cleanly for BC-55.)
  - **Logic in covered layers:** the clamp/normalise/explainer-copy logic lives in `src/app/lib/**`
    (`sessionForm.ts` / `explainers.ts`) or `src/domain/sessionLog.ts`, **not** inline in the gate-blind
    page. `adaptation.ts`/`loadMetrics.ts` are untouched (the fix is at the data-entry boundary), so no
    safety-rule-reviewer is required — but note the BC-27 load-scaling path is _why_ this matters.
  - **Tested:** the clamp helper for `sends > attempts`, `sends = attempts`, `sends < attempts`, and the
    empty case; a UI-level test that +send couples an attempt and −attempt can't go below sends; a
    round-trip test that a sanitised legacy log feeds a correct pyramid/benchmark. Helper ≥ 95% branch.
- **Files:** `src/app/lib/sessionForm.ts`, `src/domain/sessionLog.ts`, `src/app/lib/explainers.ts`,
  `src/app/components/MetricExplainer.tsx`, `src/app/session/page.tsx`, `src/app/lib/integrity.ts`,
  `tests/app/sessionForm.test.ts`
- **Sequencing:** edits `session/page.tsx` (and `sessionLog.ts`), overlapping **BC-60** (sets-input) and
  **BC-64** (freeform logging) — run **sequentially** with those; cleanest **after BC-60** since both
  touch the same logging form.

### BC-66 · Two max-effort days can land back-to-back — BC-45's "no consecutive hard days" contract isn't enforced — `open`

- **Type:** bug/safety-adjacent · **Priority:** P2 · **Complexity:** M · **Depends on:** BC-45
- **Problem (found 2026-06-23 reviewing BC-45):** BC-45's acceptance criteria explicitly promise
  "never two limit/PE days back-to-back, per the DUP tenet," and the BACKLOG claims a tested
  "no-back-to-back-limit invariant." **It is not enforced.** `sessionPlanFor` (`periodization.ts`)
  returns the two hardest sessions first (`['limit-boulder'` RPE 9`, 'power-endurance'` RPE 8`, …]`),
  and `pickDaySession` (`schedule.ts`) maps `availableWeekdays` (sorted ascending) onto rotation slots
  in order. So a climber who trains on **adjacent weekdays** gets both max-effort days on consecutive
  calendar days. **Verified failing input:** `{ sessionsPerWeek: 2, availableWeekdays: [1, 2] }` (Mon/Tue)
  → Monday = `limit-boulder` (RPE 9), Tuesday = `power-endurance` (RPE 8). The existing BC-45 test only
  asserts the per-week **count** (≤1 limit, ≤1 PE), which holds — adjacency is a calendar property
  `sessionPlanFor` alone can't express, so the gate stayed green. This is injury-adjacent: stacked
  high-intensity load is precisely the failure mode the DUP contract exists to prevent.
- **Decision needed (PO):** the fix space involves a product call, so it's filed not silently patched:
  - **Avoidable cases (n ≥ 3):** interleave the rotation so a hard day is never adjacent to the other
    hard day in the day-mapped sequence (e.g. `[limit, volume, PE, antagonist]` instead of
    `[limit, PE, volume, antagonist]`) — pure improvement, no content change, just ordering.
  - **Structurally-unavoidable case (n = 2 on adjacent weekdays):** there is no easy day to interleave.
    Options: (a) warn at onboarding/profile when chosen days force adjacency; (b) downgrade the second
    hard day to volume/technique for that layout; (c) accept + document. Pick one.
- **Acceptance criteria:**
  - A pure invariant test asserts that, for every `sessionsPerWeek` 1–7 mapped onto **any** weekday
    layout, no two `limit-boulder`/`power-endurance` sessions fall on consecutive calendar days (or, for
    the unavoidable n=2-adjacent case, the chosen mitigation fires deterministically).
  - Whatever the resolution, the BACKLOG/spec claim and the code agree. Additive-safety: the change may
    only spread or reduce intensity, never raise it. `adaptation.ts`/`loadMetrics.ts` untouched.
- **Files:** `src/domain/periodization.ts`, `src/domain/schedule.ts`, `tests/domain/periodization.test.ts`,
  possibly `src/app/lib/bootstrap.ts` (if onboarding-time validation/warning is chosen)

### BC-67 · Quick-log form fields look different (smaller, monospaced) from the rest of the app — `done`

- **Shipped (2026-06-23):** BC-64's `/log` quick-log inputs (date, duration, note) were hand-rolled with a
  **divergent** inline style — `--r-sm` radius, `--font-mono`, `--fs-sm`, tight `6px 10px` padding, no
  explicit text colour — so the form read as a smaller, monospaced, off-brand screen next to the rest of
  the app, whose fields use profile's `SELECT_STYLE` (`--r-md`, `--font-body`, `--fs-base`, bold,
  `10px 12px`, `--text`). Extracted a local `FIELD_STYLE` in `src/app/log/page.tsx` mirroring that
  canonical look and applied it to all three fields (the note `<textarea>` keeps `fontWeight: 400` —
  prose, not a value). Pure presentational change on a gate-blind page; `/log` is already in the axe a11y
  route sweep. `pnpm gate` green.
- **Type:** ux/design · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-64
- **Problem:** the quick-log page shipped with bespoke field styling that doesn't match the form look
  used everywhere else (profile / onboarding / check-in) — visibly different and worse.
- **Acceptance criteria:** `/log` fields render with the same radius/font/size/padding/colour tokens as
  the rest of the app; no new design tokens invented; gate stays green.
- **Files:** `src/app/log/page.tsx`

### BC-68 · Can't log an off-plan session from a training day (only rest days / history) — `done`

- **Shipped (2026-06-23):** BC-64 surfaced "Log a session" only on the **rest-day** Today card and
  /history. On a **training day** the Today card offered just Check-in / Start, so a climber who **missed
  their check-in or planned session** — or climbed something different — had no log affordance from Today,
  and the load/streak/Insights signals silently undercounted. Added a "Log a different session" secondary
  link to the training-day `SessionCard` (same `/log` route + `bc-btn` styling as the rest-day link). Pure
  markup on a gate-blind page; the covered `quickLog.ts` write path is unchanged. `pnpm gate` green.
- **Type:** ux/feature · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-64
- **Problem:** the only Today entry point to freeform logging was the rest-day card; a missed or off-plan
  training day was a dead end for capturing real load.
- **Acceptance criteria:** a "log a session" affordance reaches `/log` from a training day too; no change
  to the write path or the planned-session flow; gate green.
- **Files:** `src/app/page.tsx`

### BC-70 · Self-healing gate format step + Tier-1 guard — kill the most-recurring inner-loop failure — `done`

- **Shipped (2026-06-23):** hand-editing docs (BACKLOG / HANDOFF / specs) and tripping `pnpm gate` step 1
  (`format:check`) was the **single most-recurring inner-loop gate failure** — logged as prose three
  times (LEARNINGS 2026-06-09, 2026-06-13, 2026-06-23) and re-hit each time, far past the ledger's own
  "≥2× → promote to an automated check" rule. Promoted prose → automation: `scripts/gate.sh` step 1 now
  **self-heals locally** (`pnpm format` = `prettier --write`) and stays **strict in CI** (`format:check`),
  branched on `${CI:-}`. Commits are already Prettier-clean via the pre-commit lint-staged hook, so CI's
  `--check` still passes and still fails any unformatted commit — the merge guarantee is intact;
  `prettier --write` is deterministic + idempotent so it never masks a real failure. New Tier-1 guard
  `tests/harness/gate-format-selfheal.test.ts` reads `gate.sh` and asserts both paths stay wired, so the
  fix can't silently regress. The recurring format trip is now structurally impossible. `pnpm gate` green.
- **Type:** infra/ci · **Priority:** P2 · **Complexity:** S · **Depends on:** —
- **Problem:** the inner-loop gate `--check`s formatting but never fixes it, so every agent that hand-edits
  a doc and runs `pnpm gate` before committing burns a cycle on step 1. The lesson was written as prose
  ≥3× instead of being automated, exactly the "mistake seen but not promoted" anti-pattern.
- **Acceptance criteria:** the gate auto-fixes formatting locally and keeps the strict `--check` in CI; a
  Tier-1 test asserts both paths so a revert fails the gate by name; the merge-time guarantee (no
  unformatted commit reaches `main`) is preserved.
- **Files:** `scripts/gate.sh`, `tests/harness/gate-format-selfheal.test.ts`

### BC-71 · Frontend form-field consistency — one canonical `FIELD_STYLE` + Tier-1 anti-drift guard — `done`

- **Shipped (2026-06-23):** the **same design-drift bug shipped twice** — a page hand-rolled an inline
  form-field box with off-canonical tokens (`--r-sm`, `--font-mono`, `--fs-sm`) instead of the app's look:
  **BC-67** (`/log` date/duration/note) and **BC-60** (session "sets" input). Both were caught by eye and
  fixed by hand; the canonical box was also **duplicated** across `profile`/`log`/`session`. Promoted the
  lesson from prose → automation: consolidated the canonical box into one covered module
  `src/app/lib/fieldStyles.ts` (`FIELD_STYLE`, design-system tokens only), and `profile`/`log`/`session`
  now spread it (overriding only layout/size). New Tier-1 guard
  `tests/harness/design-consistency.test.ts` scans every `src/app/**/page.tsx` and fails by file name if
  any inlines the **field-box signature** (`borderRadius` + `border:` + `padding` + `fontFamily` — unique
  to text-entry fields, so false-positive-free; a `...FIELD_STYLE` spread inherits and passes). The
  detector ships with its own non-vacuous self-tests. `pnpm gate` green (bundle 167.8 KB, behavior-preserving).
- **Type:** ux/infra · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-67
- **Problem:** inline `style={{…}}` on a form control is invisible to the gate (gate-blind pages, no
  token-usage lint), so a divergent field passes every check — exactly how BC-67/BC-60 shipped. The
  lesson was being fixed by hand each time instead of promoted to a check.
- **Acceptance criteria:** one shared canonical field style; all page form controls use it; a Tier-1
  test fails when a page re-rolls the field box inline; no false positives on Cards/dividers/steppers; no
  behavior change; gate green.
- **Files:** `src/app/lib/fieldStyles.ts`, `tests/harness/design-consistency.test.ts`,
  `src/app/log/page.tsx`, `src/app/profile/page.tsx`, `src/app/session/page.tsx`

### BC-21 · Single repo instance — `done`

- **Shipped:** `src/data/repoInstance.ts` exports `getRepo(): IClimbRepo` — a **lazily-constructed**
  singleton (`instance ??= new DexieClimbRepo()`). All 15 `new DexieClimbRepo()` call sites across the 8
  page files now use `getRepo()`, so the app holds one Dexie connection and one seam to swap when a
  sync-capable repo (BC-18) lands. Lazy so no Dexie is constructed during SSR — the first call lands in a
  client effect. TDD: `tests/domain/repoInstance.test.ts` asserts identity (same instance across calls) +
  that it's the `DexieClimbRepo` impl; `repoInstance.ts` 100%. Behavior-preserving (only the prettier
  method-chain reflow differs in the pages). `pnpm gate` green.
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
- **PO idea evaluated (2026-06-15) — phone→laptop LAN offload:** the idea was to record on the phone,
  auto-discover a laptop on the same Wi-Fi, and stream the clip there for heavier analysis.
  **Verdict: feasible but not worth it for the MVP — keep as a documented fallback only.** Three walls:
  (1) a **PWA cannot do LAN/mDNS discovery from JavaScript** — "automatically knows" needs a native
  app or a manual pair step (QR scan / type the laptop's local IP); (2) **mixed content** — the HTTPS
  PWA can't call `http://192.168.x.x`, so transfer needs WebRTC or a self-signed-cert local server
  (real user friction); (3) it solves a compute problem that **on-device MediaPipe already largely
  solves** (the research found ~30fps pose on a modern phone; heavy models like ViTPose-large /
  hold detection are the explicitly out-of-scope XL tail). If heavier compute is ever genuinely needed,
  **uploading the clip to a serverless function** (already on Vercel) sidesteps discovery + mixed-content
  entirely; for the **thesis**, a plain desktop Python pipeline over a recorded file is the
  lowest-friction path. So on-device stays the MVP/thesis default; LAN/cloud offload is a future option,
  not a near-term PBI.
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

### BC-69 · Social layer — share activity + share to social media (and a future social platform) — `open` (design-first)

- **Type:** system-design/social · **Priority:** P3 · **Complexity:** L (share slice) → XL (full platform) · **Depends on:** BC-43
- **Vision (PO idea 2026-06-23):** make training shareable and, longer-term, social — (a) **share to
  social media**: a one-tap "share my session / week / pyramid" producing a branded image or text via the
  **Web Share API** (`navigator.share`, with a copy-link / download-image fallback on desktop), no
  backend; (b) **share activity to a friend or coach** (read-only snapshot — this is exactly BC-43's
  "shareable program/progress snapshot," so the two MUST be specced together, not divergently); (c) a
  **social platform** (feed, follows, kudos) — the big bet.
- **The hard call this PBI must make (PO):** a real social _platform_ needs accounts + a backend +
  multi-user data, which **breaks the app's defining no-backend, on-device, health-data-private posture**
  (the same tension as BC-18 sync and BC-57 observability). Slice (a) is the cheap, posture-preserving win
  and ships without any of that; slice (b) reuses BC-10 serialization; slice (c) is a separate
  product/architecture decision that may not be worth the privacy trade-off. The spec must decide where
  the line is, not assume the platform.
- **Acceptance criteria:** **design spec only** (`docs/specs/`). Explore: Web Share API image/card
  generation (what's on the card — pyramid + streak + ACWR trend + brand mark — and the **privacy
  default: progress yes, raw pain/injury logs NEVER**, mirroring BC-43); the fallback when
  `navigator.share` is absent; whether (c) the social platform is in scope at all given the no-backend
  posture, and if so the minimal multi-user architecture + its data-privacy contract. **Fold the
  read-only-snapshot half into BC-43 so the two don't diverge.** No app code until scheduled.
- **Files:** `docs/specs/social-sharing-design.md`

### BC-55 · Indonesian-first i18n with EN/ID language toggle — `open` (**design spec + plan drafted 2026-06-16**)

- **Type:** ux/i18n · **Priority:** P2 · **Complexity:** L · **Depends on:** —
- **Design spec + implementation plan drafted (2026-06-16):**
  [`docs/specs/i18n-indonesian-design.md`](specs/i18n-indonesian-design.md) +
  [`docs/plans/i18n-indonesian-plan.md`](plans/i18n-indonesian-plan.md) (brainstorming session; next-intl
  weighed via Context7). **Decision: a typed dictionary (`src/app/lib/i18n.ts`), not next-intl** — this is
  a client-rendered, no-URL-routing, statically-exported PWA where locale is a Settings toggle, so
  next-intl's server/routing-centric value is wasted and risks the 200 KB budget. The seam is the i18n
  sibling of BC-25's `theme.ts` (`resolveLocale`/`nextLocale`/`isLocale` + a `LocaleProvider`/`useT` hook +
  a `LanguageToggle` beside the theme toggle + a no-flash `<html lang>` inline script). A **Tier-1 parity
  test** makes "no untranslated key renders" executable (EN/ID key + `{placeholder}` parity). Indonesian is
  authored intuitively (folds BC-56's jargon reduction — §8 glossary). Sliced: seam+gate → toggle → chrome
  extraction → coaching surface → an **isolated safety slice** that restructures `AdaptationChange.reason`
  → `{messageKey, params}` (touches `adaptation.ts`, needs safety-rule-reviewer). Instructional content
  catalog (drills/exercise steps) is **out of scope** (separate large surface; follows BC-62). **Pending PO
  review; no bulk string migration until approved.**
- **Problem:** the primary audience is **Indonesian boulderers**, but every string is hardcoded
  English across ~12 page/component files — there is no i18n seam. The app is also globally friendly,
  so language must be a **toggle (ID + EN)**, with Indonesian as a first-class language (authored, not
  a machine-translation afterthought). This is the home for the "less jargon / intuitive copy" request
  (#6 of the 2026-06-14 batch): copy is rewritten **once, intuitively, in both languages** rather than
  rewriting English now and re-translating later.
- **Acceptance criteria:** **design spec first** (`docs/specs/`). Explore: a lightweight typed
  dictionary (`src/app/lib/i18n.ts` — covered) vs a framework (next-intl); locale detection +
  persistence (localStorage, respects `navigator.language` on first load); a string-extraction pass
  that moves user-facing copy out of gate-blind `page.tsx` into covered modules where possible; a
  toggle in the profile/settings screen; how ACWR/RPE and other domain terms read intuitively in ID
  (plain-language gloss, not literal). A Tier-1 test asserts no untranslated key renders. **No bulk
  string migration until the spec is approved.**
- **Files:** `docs/specs/i18n-indonesian-design.md`

### BC-56 · Nielsen-heuristics UX audit + jargon reduction — `open` (design-first)

- **Type:** ux/design · **Priority:** P2 · **Complexity:** L · **Depends on:** BC-55
- **Problem:** beyond the ACWR/RPE explainers (handled in-app), copy across the product still leans on
  technical terms and terse states that hurt comprehension for non-coach users. A structured pass
  against Nielsen's 10 heuristics (visibility of system status, match to real-world language, error
  recovery, recognition over recall, consistency) would lift the whole app's intuitiveness.
- **Acceptance criteria:** **audit doc first** (`docs/specs/`): walk each primary screen against the 10
  heuristics, list concrete violations + fixes, prioritise. Many copy fixes **fold into BC-55's
  bilingual rewrite** (do them once, in both languages) — this PBI owns the audit + the non-copy
  heuristic fixes (status feedback, error affordances, consistency). **No code until the audit is
  reviewed.**
- **Files:** `docs/specs/nielsen-ux-audit.md`

### BC-57 · Error observability (stage-6 monitoring) — deferred until there are real users — `open` (design-first)

- **Type:** infra/observability · **Priority:** P3 · **Complexity:** M · **Depends on:** —
- **Problem:** the Micro-SDLC "Maintenance & Feedback" stage is **partially** covered — `@vercel/analytics`
  - Speed Insights give traffic + Web Vitals, but **crashes are invisible**: `error.tsx` /
    `global-error.tsx` only `console.error` the digest on the _user's_ device. The dev never sees a
    production crash. **Deliberately deferred** (2026-06-14, product decision): adding crash telemetry now
    is premature per Minimum-Viable-Thinking — there's no user base yet, and it fights three real
    invariants below. Implement when real traffic exists and you actually need crash visibility.
- **Hard constraints any implementation MUST respect:**
  1. **Privacy** — the app stores injury/health data on-device and is local-first by design. Error
     payloads/breadcrumbs MUST be scrubbed of all health/injury/profile data; report message + digest
     only, never user records. Consider opt-in.
  2. **Bundle** — first-load JS is ~168/200 KB (BC-36 gate). The Sentry browser SDK (~30–50 KB) would
     likely breach the budget; either pick a lighter approach (a tiny scrubbed error beacon to a Vercel
     log/endpoint) or raise the budget _consciously_ with justification.
  3. **No-backend posture** — the README states the app has no env vars / no `vercel.json`. A Sentry DSN
     reintroduces an env var; weigh that against the local-first selling point.
- **Acceptance criteria:** **design spec first** (`docs/specs/`) choosing between (a) `@sentry/nextjs`
  privacy-scoped, (b) a self-built scrubbed beacon, or (c) keep-as-is; with the privacy-scrub rule as a
  testable contract. **No SDK added until the spec is approved and a user base justifies it.**
- **Files:** `docs/specs/error-observability-design.md`

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
P3 design specs, when a milestone schedules them: BC-18 · BC-24 · BC-41 · BC-42 · BC-43 · BC-55 · BC-56 · BC-57 · BC-58 (real reminders, supersedes BC-20's gap)   (BC-19 absorbed by BC-48; BC-20/BC-21 done)

Open P2 (PO-filed 2026-06-16, do next — user-reported bugs + audience/data gaps):
  Real bugs (cheap, high-trust):   BC-60 (sets-input, S) · BC-61 (iOS safe-area, S) · BC-59 (streak window, M)
  Logging correctness & clarity:   BC-65 (attempts/sends — sends can exceed attempts + no explainer, M, after BC-60)
  Audience & data integrity:       BC-63 (beginner program content — VB/V0 still gets RPE-9 limit, M, after BC-62) · BC-64 (freeform logging — off-plan climbing uncapturable, M)
  Infra/reminders:                 BC-62 (content catalog + validation, M) · BC-58 (reminders that fire when closed, L)
```

> **The logging form is now a cluster — sequence it.** BC-60 (sets-input), BC-64 (freeform log), and
> BC-65 (attempts/sends invariant + explainer) all edit `src/app/session/page.tsx` and the log write
> path. Do them **sequentially**, ideally BC-60 → BC-65 → BC-64, so the same form is touched once per
> concern, not three-way merged.

> **Why BC-63/BC-64 rank high:** both are _correctness_ gaps in the core promise, not polish. BC-63 is a
> safety+credibility defect for an audience the app _already onboards_ (a novice handed RPE-9 limit work).
> BC-64 starves every downstream signal (ACWR-safety, streak, Insights) of real load — it compounds. Ship
> the two `S` bug fixes (BC-60/61) first for quick trust wins, then these.

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
