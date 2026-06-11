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

## Current state — 2026-06-11 (last touched by: Claude Opus 4.8)

- **Ledger retrieval added — `pnpm learnings <file-or-keyword>` ("look up, don't load").** The ledger
  is long-term memory; a fresh agent now pulls ONLY the entries relevant to what it's touching instead
  of reading all 350+ lines. `pnpm learnings` (no arg) prints the index; a query prints the full block
  of each matching entry (case-insensitive, header + body). Plain awk/grep — deliberately NOT a vector
  DB (YAGNI at this scale; the gate stays plain shell+git). Tier-1: `tests/harness/learnings.test.ts`
  pins the retrieval contract. Docs reframed from "grep the ledger" → the lookup command across
  `AGENTS.md`, `CLAUDE.md`, `README.md`, `onboard.sh`, and this file. (UNCOMMITTED — see Pending.)
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

## Pending (uncommitted) — ledger-retrieval (`pnpm learnings`)

The `pnpm learnings` retrieval seam + its doc reframe are **staged in the working tree, not yet
committed** (the human commits — agents never `git push`). Files: `scripts/learnings.sh` (new),
`tests/harness/learnings.test.ts` (new), `package.json`, `scripts/onboard.sh`, `AGENTS.md`,
`CLAUDE.md`, `README.md`, `docs/LEARNINGS.md`, `docs/HANDOFF.md`. Suggested commit:
`feat(harness): retrieve ledger lessons on demand (pnpm learnings), reframe docs from full-read`.

Before this change the tree was clean on `main` (`pnpm gate` green: **35 test files, 175 tests**,
type-coverage ≥99.8%). All
feature + `agent/*` branches merged + deleted; no worktrees but the primary. **Note:** a PR #2 merge
race once dropped the security commits; they were recovered via cherry-pick in PR #4 — when merging,
verify the PR head SHA equals local HEAD.

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

1. **Next parallel batch (Crew).** On `main`, `pnpm crew start` (now `maxWorkers: 3`) will pick the next
   file-disjoint set. Top unblocked P1s: **BC-07** (neutral-check-in flag + adaptation log) and **BC-10**
   (data export/import). NOTE BC-07/BC-10 both share files with each other or BC-06's area — the
   scheduler resolves disjointness, but check `pnpm crew status`. **Supervise it** (don't walk away):
   workers can be killed mid-task (session/usage limits) leaving uncommitted worktree state to finish.
2. **Do NOT let it churn into deferred/unsuitable PBIs.** `BC-14` (icons) needs real art, `BC-15`
   (Vercel deploy) needs secrets, `BC-24` (CV coach) is explicitly _future, do not start_. Their status
   is `open`, so the scheduler **will** assign them — `pnpm crew pause` after the intended batch, or set
   `maxWorkers` to bound the run.
3. **Or work `docs/BACKLOG.md` from P1 by hand** — next is **BC-07** (size M).

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
