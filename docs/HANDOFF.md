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

- **App:** Plans 1–3 shipped and on `origin/main`. Working PWA: Today, check-in, session player,
  history, insights, program calendar, drills library, offline service worker.
- **Domain (pure):** loadMetrics, warmup, periodization, adaptation (safety), sessionLog, insights,
  drills. All tested; gate green (branches ≥ 90%, adaptation/loadMetrics 100%).
- **Last work:** post-handoff review fixed gate-blind defects left by a cross-model handoff —
  network-first service worker, installable manifest icon, doc drift, untracked Playwright artifact.
  Promoted those lessons to a gate check (`tests/pwa/manifest.test.ts`).

## Next actions (prioritized)

1. **Real PWA icons** — `public/icon.svg` is a placeholder mark. Replace with branded 192/512 PNGs (or
   a finalized SVG) when design is ready. The manifest test only enforces _presence_, not quality.
2. **Lighthouse-PWA e2e** — candidate next Tier-1 promotion: assert installability + offline in CI.
3. Anything in `docs/plans/` not yet built; otherwise next feature starts with `superpowers:brainstorming`.

## Open threads / known gate-blind risks

> Gate-blind = a real defect a green `pnpm gate` will NOT catch. These need a human/second-model eye.

- **Service-worker runtime behavior** — strategy is guarded by a string test, but real offline/update
  behavior is only verifiable in a browser. Bump `CACHE` in `public/sw.js` on any shell-breaking release.
- **Manifest icon _quality_** — presence is enforced; the actual art is not.
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
