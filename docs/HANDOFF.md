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

## Current state — 2026-06-12 (last touched by: Claude Opus 4.8)

- **BC-23 follow-up (this session) — prod-only brand-font regression fixed and committed.** After
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
