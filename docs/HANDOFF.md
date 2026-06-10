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

## Current state — 2026-06-10 (last touched by: Claude Opus 4.8)

- **App:** Plans 1–3 + **all five P0 backlog items (BC-01…BC-05)** shipped. PWA: Today (now with a
  rest-day recovery card), check-in, session player (now captures attempted/sent grade tallies +
  warm-up checklist gating), history, insights, program calendar, drills, offline SW.
- **Domain (pure):** loadMetrics, warmup, periodization, **programClock** (BC-01), **schedule**
  (BC-03), adaptation (safety — now with progression/regression rules 6–7, BC-05), sessionLog,
  insights, drills. Gate green; adaptation/loadMetrics + schedule all 100% branch.
- **Last work:** the P0s were committed as **`9f009bd`** by a cross-agent handoff (DeepSeek V4 Flash
  via OpenCode). This session (Opus 4.8) then **scrutinized and hardened** that commit — see "Pending
  (uncommitted)". The cross-agent commit also left stale `awaiting commit` statuses and skipped the
  mandated safety-file review; both reconciled (statuses → `done (9f009bd)`; review ran → PASS).

## Pending (uncommitted) — review, then commit

Working tree holds gate-green quality fixes on top of `9f009bd` (no git ops performed — per the
human's "never auto-commit" rule):

- **BC-04 grade capture rewritten** (`src/app/session/page.tsx`): committed `bumpGrade` was buggy
  (`−` appended a lower grade instead of decrementing; arrays only grew; `expandTally` was dead
  code). Now a per-grade `{grade: count}` tally that uses `expandTally` at save. New integration
  test `tests/domain/sessionCapture.test.ts` (tally → log → repo → Insights pyramid, fake-indexeddb).
- **schedule.ts hardened** (`src/domain/schedule.ts`): removed an unreachable `?? restSession`
  branch (was 75% branch); a training weekday with no planned session now rests. +2 tests → 100%.
- **BC-05 safety review** ran retroactively → **PASS** (recorded in BACKLOG).

## Next actions (prioritized)

1. **Commit the pending fixes** (suggested: `fix(session): tally-based grade capture + schedule
hardening + BC-04 integration test`). Gate is green.
2. **Then work `docs/BACKLOG.md` from P1** — next unblocked item is **BC-06** (onboarding & profile
   screen; profile is still the hardcoded `DEFAULT_PROFILE`). Size M → `docs/plans/` plan first.

## Open threads / known gate-blind risks

> Gate-blind = a real defect a green `pnpm gate` will NOT catch. These need a human/second-model eye.

- **Session player UI is gate-blind** — React components have no RTL/jsdom harness here, so the
  capture/checklist UI is only indirectly tested (via `app/lib` helpers + the integration test).
  Real tap-through is unverified until a Playwright flow exists (relates to BC-16).
- **Safety-file review is Tier-2 prose, not a gate** — the cross-agent commit proved an agent on
  another tool will skip `safety-rule-reviewer`. Candidate promotion: a pre-commit marker check on
  `adaptation.ts`/`loadMetrics.ts` (see LEARNINGS 2026-06-10).
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
