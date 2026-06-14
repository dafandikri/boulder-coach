# Insights UX cleanup + CI ratchet — design

**Date:** 2026-06-14 · **Author:** Claude Opus 4.8 (supervised, dafandikri) · **Branch:** `feat/insights-ux-cleanup-ci-ratchet`

## Origin

Product-owner (dafandikri) batch of UX + quality requests, triaged 2026-06-14. The batch mixed
small UX fixes with two whole subsystems (Indonesian localization, full UX audit). This spec covers
only the **safe, high-confidence work shippable in one PR this session**; the subsystems are logged
as design-first backlog PBIs (BC-44, BC-45) for their own brainstorm cycles.

## In scope (this PR)

### A. UX cleanup — presentational edits, gate-blind `page.tsx` files

The app's metric education (RPE/ACWR explainers) currently sits on **Home**, away from where the
numbers actually appear. That violates Nielsen #6 (recognition over recall) and #8 (aesthetic /
minimalist) — Home should be action-focused; education belongs next to the metric.

1. **Onboarding spacing** (`src/app/profile/page.tsx`) — the _Training days_ and _Past injuries_
   fieldsets sit only `space-y-4` (16px) apart, so the "Past injuries" legend visually crowds the
   day chips. Increase separation (wrapper `space-y-6`) so the two groups read as distinct.
2. **Home declutter** (`src/app/page.tsx`) — remove the two `MetricExplainer` blocks. Home keeps
   readiness + actions only.
3. **Insights `(i)` placement** (`src/app/insights/page.tsx`) — move the ACWR explainer beside the
   **ACWR** StatCard and the RPE explainer beside the **Sessions / Avg RPE** StatCard, each with a
   short visible hint, instead of both grouped under one caption. The modal dialogs themselves
   (shipped PR #42, a11y-gated PR #43) are unchanged.
4. **Copy** — minimal only. Because the chosen i18n direction (BC-44) rewrites copy intuitively in
   both languages at once, no English-only rewrite is done here (would be redone during i18n).

**Testability:** these files are gate-blind (no React harness, by project rule — logic must live in
covered layers). The edits are pure markup/composition. The Playwright **a11y** (`e2e/`) specs that
assert the explainer modal's open-state contract must still pass after repositioning.

### B. CI ratchet — capture existing headroom, measured with margin

Measured 2026-06-14: actual global branch coverage **98.69%** vs a **80%** floor. The floors are far
below reality, so tightening is mostly free.

- **Coverage** (`vitest.config.ts`): close the ~4 stray uncovered lines (`periodization.ts` 181/273,
  `bootstrap.ts` 204, `backup.ts` 95), then raise floors — `global` branches **80→95**, lines/stmts
  **90→95**; `domain/**` branches **90→93**; safety files stay **100%**. Each floor set _below_
  measured actual with margin so no file flakes.
- **Lighthouse** (`lighthouserc.json`): ratchet category budgets up toward measured localhost scores
  (a11y 0.90→0.95, best-practices 0.90→0.95, perf 0.80→0.85). Re-run `pnpm lighthouse` first; never
  set above `actual − margin`.
- **Mutation** (`stryker.config.json`): re-run `pnpm mutation`, then ratchet `low`/`break` up toward
  the measured score with margin (comment rule: "ratchet up, never lower").

**Principle:** every threshold set from a measurement taken this session, below actual with margin —
no coverage theatre, no flaky gate.

## Out of scope (logged, not built)

- **BC-44 — Indonesian-first i18n with EN/ID toggle.** Primary audience is Indonesian boulderers,
  but globally friendly via a language toggle (Indonesian as a first-class language, not an
  afterthought translation). Lightweight dictionary (no heavy framework), locale persisted locally,
  string extraction across ~12 files. Folds in the plain-language rewrite so copy is authored
  intuitively once, in both languages. **L/XL, design-first.**
- **BC-45 — Nielsen-heuristics UX audit / jargon reduction** beyond ACWR/RPE (error messages,
  visibility of system status, consistency). **L, design-first.** May merge into BC-44's copy pass.
- **Literal "100% coverage everywhere"** — rejected: gate-blind UI components cannot be covered;
  chasing the number would be churn, not quality.

## Acceptance criteria

- Home no longer renders the metric explainers; Insights shows an `(i)` hint next to both ACWR and
  Session-RPE stats; onboarding fieldsets are visually separated.
- `pnpm gate` green with the raised coverage floors.
- `pnpm lighthouse` and `pnpm mutation` green at the ratcheted thresholds (verified, not asserted).
- `e2e/` a11y explainer specs still pass.
- BC-44 + BC-45 added to `docs/BACKLOG.md`; `docs/HANDOFF.md` updated last.
