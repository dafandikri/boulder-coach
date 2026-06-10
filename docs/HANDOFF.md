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
3. `grep` `docs/LEARNINGS.md` for any file/module you will edit. Fix from the lesson, not blind retry.
4. Do the work under TDD; `pnpm gate` must be green before commit (it runs on Stop + pre-push + CI).
5. **Before you stop:** update this file (state + next actions), append a ledger entry for any failure,
   and update `README`/`AGENTS.md`/specs if behavior or infra changed (same commit).

---

## Current state — 2026-06-11 (last touched by: Claude Opus 4.8)

- **App:** Plans 1–3 + **all five P0 backlog items (BC-01…BC-05)** + the font-flake build fix (`fd0b4be`)
  are committed on `main`. PWA: Today, check-in, session player, history, insights, program, drills, SW.
- **NEW — Crew multi-agent orchestrator** (branch **`feat/crew-orchestration`**, gate-green, pushed):
  a git-native, tool-neutral system to run up to 3 agents in parallel worktrees on file-disjoint PBIs,
  with reviewer-gated tiered auto-merge and human override. `pnpm crew start|status|approve|reject|
pause|resume`. See `docs/crew/README.md` + the spec/plan under `docs/superpowers/`.
- **Domain (pure):** loadMetrics, warmup, periodization, programClock, schedule, adaptation (safety),
  sessionLog, insights, drills. Gate green; adaptation/loadMetrics + schedule all 100% branch.

## Pending (uncommitted) — none

All Crew work is committed on `feat/crew-orchestration` (planning docs → Phases 1–8 → the three
limitation fixes below). Final `pnpm gate` green (**31 test files, 130 tests**, type-coverage 99.82%).

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

- A true end-to-end run with **live agent CLIs + real worktrees** isn't in CI (you can't cheaply spawn
  Claude/Codex in the gate); the orchestration logic is now fully faked-tested, the shell adapters and
  real git calls are exercised only by running `pnpm crew start`.

## Next actions (prioritized)

1. **`feat/crew-orchestration` is pushed** — open a PR / merge when ready. Optionally `pnpm crew start`
   to dogfood Crew on the P1 backlog.
2. **Then work `docs/BACKLOG.md` from P1** — next unblocked item is **BC-06** (onboarding & profile
   screen; profile is still the hardcoded `DEFAULT_PROFILE`). Size M → `docs/plans/` plan first.

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
