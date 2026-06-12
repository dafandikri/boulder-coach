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

### BC-14 · Real PWA icons (carried from HANDOFF) — `open`

- **Type:** infra/design · **Priority:** P2 · **Complexity:** S
- **Problem:** `public/icon.svg` is a placeholder mark; the manifest test enforces presence, not
  quality. Install-to-home-screen currently looks unfinished.
- **Acceptance criteria:** branded 192/512 maskable PNGs (+ apple-touch-icon), manifest updated,
  `tests/pwa/manifest.test.ts` extended to require the maskable purpose + both sizes.
- **Files:** `public/manifest.webmanifest`, `tests/pwa/manifest.test.ts`

### BC-16 · Installability + offline e2e in CI (carried from HANDOFF) — `open`

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

### BC-26 · Tier-1 guard: dev-only tooling must stay out of production `dependencies` — `open`

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

### BC-27 · Benchmark / assessment session — recalibrate `currentGrade` — `open`

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

### BC-28 · Readiness score on Today — `open`

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

### BC-29 · Injury-history-aware baseline (restore `injuryHistory[]`) — `open`

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

### BC-30 · Grade-pyramid goal & gap tracking — `open`

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

### BC-31 · Persistent storage + eviction warning — `open`

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

### BC-32 · Schema-migration safety net + load-time integrity validation — `open`

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

### BC-33 · Global error boundary + crash recovery UI — `open`

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

### BC-34 · Backup-reminder nudge — `open`

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

### BC-35 · Mutation testing on the safety files (Stryker) — `open`

- **Type:** ci/test · **Priority:** P2 · **Complexity:** M · **Depends on:** —
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

### BC-36 · Bundle-size budget (Tier-1 gate) — `open`

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

### BC-37 · Accessibility audit gate (axe-core in e2e) — `open`

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
  instead of reading one number.
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

### BC-40 · Training streak / consistency on Today — `open`

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
Harness compounding (run anytime, solo):     BC-26 · BC-35 (safety mutation) · BC-36 (bundle) · BC-37 (a11y) · BC-16 (offline e2e)
Coach intelligence:                          BC-28 → BC-30 → BC-27 → BC-29 (BC-29 = safety protocol)
Polish (after BC-14 icons / brand settled):  BC-14 → BC-38 → BC-40 → BC-39 · BC-25 (dark mode)
P3 design specs, when a milestone schedules them: BC-18 · BC-19 · BC-20 · BC-21 · BC-24 · BC-41 · BC-42 · BC-43
```

> Good disjoint pairs for parallel Crew runs (no shared `Files:`): **BC-35 + BC-30**,
> **BC-36 + BC-28**, **BC-37 + BC-32**. Anything touching `src/app/page.tsx` (BC-27/28/31/34/39/40)
> must run **sequentially** — they share the Today page.

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
