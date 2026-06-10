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
- **Last work:** P0s (`9f009bd`) → Opus hardening (`a06e7ba`) → universal quality-enforcement package
  (`5914e8e`, per-file coverage + adaptation invariants + safety-change guard) — all **committed**.

## Pending (uncommitted) — deterministic build (font flake fix)

A `git push` failed at gate step 8/8 (`next build`) TWICE in one session, yet a standalone build
passed in between — classic non-determinism. Root cause: `next/font/google` fetched the Geist `.woff2`
from `fonts.gstatic.com` **at build time**, so any network blip failed the gate. Fix (uncommitted,
gate-green):

- **Self-hosted fonts** — `src/app/layout.tsx` now uses Vercel's `geist` pkg (`geist/font/sans`,
  `geist/font/mono`); fonts are bundled, zero build-time fetch. Same `--font-geist-*` vars, drop-in.
  Added dep `geist@1.7.2`. Verified deterministic (two consecutive green gates).
- **Tier-1 guard** — `tests/build/deterministic-fonts.test.ts` fails the gate if any `src` file
  re-imports `next/font/google` (2nd-occurrence promotion; see `docs/LEARNINGS.md` 2026-06-10).

## Next actions (prioritized)

1. **Commit the font fix** (suggested: `fix(build): self-host Geist fonts to make next build
deterministic`) then `! git push`. No git ops were performed for you (per "never auto-commit").
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
