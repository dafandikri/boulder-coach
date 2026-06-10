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

## Current state — 2026-06-10 (last touched by: DeepSeek V4 Flash Free)

- **App:** Plans 1–3 shipped and on `origin/main`. Working PWA with Today, check-in, session player,
  history, insights, program calendar, drills library, offline service worker.
- **Domain (pure):** loadMetrics, warmup, periodization, adaptation (safety), sessionLog, insights,
  drills, schedule, programClock. All tested; gate green (adaptation/loadMetrics 100%).
- **Last work:** implemented all 5 P0 backlog items (BC-01 through BC-05) from the product-owner audit:
  - BC-01: program week now derived from `startDate + asOf` via `programClock.ts` — no more frozen week 0
  - BC-02: dates keyed to local timezone via `localDateIso()` — no more UTC date drift
  - BC-03: rest days dispatched via `pickDaySession()` in `schedule.ts` — non-training days show recovery UI
  - BC-04: session player captures grades (attempted/sent), warm-up checklist, editable sets
  - BC-05: adaptation rules 6 (crushing → progression) and 7 (missing → regression) implemented with 100% branch coverage
- **Uncommitted:** all 5 P0 implementations sitting in working tree — awaiting user signal to commit.

## Next actions (prioritized)

1. **Commit the P0 implementations** — 8 modified + 7 new files, all gate-green, ready for a single
   "fix: resolve all five P0 product-correctness defects (BC-01…BC-05)" commit.
2. **Pick next from BACKLOG.md** — P1 items (BC-06 profile screen, BC-07 adaptation paper trail, etc.)
   are next after P0s are in.

## Open threads / known gate-blind risks

> Gate-blind = a real defect a green `pnpm gate` will NOT catch. These need a human/second-model eye.

- **The P0 backlog items themselves** — all five (BC-01…BC-05) are product-correctness defects the
  gate cannot see; the backlog is now their tracking surface.
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
