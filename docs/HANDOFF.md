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
- **NEW — Crew multi-agent orchestrator** (branch **`feat/crew-orchestration`**, gate-green, NOT pushed):
  a git-native, tool-neutral system to run up to 3 agents in parallel worktrees on file-disjoint PBIs,
  with reviewer-gated tiered auto-merge and human override. `pnpm crew start|status|approve|reject|
pause|resume`. See `docs/crew/README.md` + the spec/plan under `docs/superpowers/`.
- **Domain (pure):** loadMetrics, warmup, periodization, programClock, schedule, adaptation (safety),
  sessionLog, insights, drills. Gate green; adaptation/loadMetrics + schedule all 100% branch.

## Pending (uncommitted) — none

All Crew work is committed on `feat/crew-orchestration` (16 commits: planning docs → Phases 1–8). The
final `pnpm gate` is green (27 test files, 112 tests). Nothing is pushed (repo policy: human pushes).

## Crew — what shipped (branch `feat/crew-orchestration`)

- **Pure core (TDD, `// @ts-check`):** `scripts/crew/lib/{glob,backlog,schedule,risk,lease,claims,
manager}.mjs` — backlog parsing, dependency-gated **file-disjoint** scheduling (the conflict lock),
  tiered-merge risk classifier, lease expiry, atomic claims. Tested in `tests/crew/`.
- **Wiring:** `conduct.mjs` (conductor loop), `merge.mjs` (rebase→gate→ff-merge), `crew.mjs` (CLI),
  `lib/{git,launch,review}.mjs`, `adapters/{claude,codex,aider}.sh`, `prompts/*.md`, `.crew/config.json`.
- **Backlog is now load-bearing:** every open PBI has a `Files:` set; `tests/crew/backlog-hygiene.test.ts`
  fails the gate if one doesn't (the lock depends on it).

## Next actions (prioritized)

1. **Review + merge `feat/crew-orchestration`** (the human pushes). Optionally `pnpm crew start` to
   dogfood Crew on the P1 backlog.
2. **Then work `docs/BACKLOG.md` from P1** — next unblocked item is **BC-06** (onboarding & profile
   screen; profile is still the hardcoded `DEFAULT_PROFILE`). Size M → `docs/plans/` plan first.

## Known limitations (Crew v1, honest)

- Wiring `.mjs` (conduct/crew/merge/git/launch/review) aren't imported by tests, so they're outside
  tsc/type-coverage — verified by reading, not by the gate. Real multi-worker runs are unexercised in
  CI (the conductor loop + adapters need a live agent CLI). The manager brain currently **logs** split
  suggestions but doesn't yet create sub-task claims (acting-on-split is a follow-up).

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
