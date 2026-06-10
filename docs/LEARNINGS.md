# Learnings Ledger

Append-only. Every gate failure, feedback-loop iteration, and safety escalation gets one entry.
Read-before-write: before a task, grep this file for the file/module you're touching.

## Entry format

```
## YYYY-MM-DD — <file> — <gate stage> (<test|type|lint|arch|coverage|safety>)
- **Task:** <which plan task>
- **What failed:** <symptom>
- **Root cause:** <why>
- **Fix:** <what changed>
- **Prevention:** <skill/rule/check update — or "promote to automated check" if 2nd occurrence>
- **Attempts to green:** <n>
```

## Promotion rule

When a failure category appears **≥ 2 times**, promote it into an automated check:

- repeated `any`/unsafe cast → stricter ESLint rule + type-coverage bump
- repeated layering violation → new dependency-cruiser rule
- repeated rule-table paraphrase → sharper domain-rule-authoring assertion
- repeated missed boundary → CLAUDE.md checklist line + required boundary test

---

<!-- entries below -->

## 2026-06-10 — src/app/layout.tsx — build (test)

- **Task:** Unblock `git push` (gate step 8/8 failing).
- **What failed:** `next build` failed with `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'` + "Error while requesting resource … fonts.gstatic.com". FLAKY: failed on push, yet a standalone `pnpm build` moments later passed (exit 0) — same code, same machine.
- **Root cause:** `next/font/google` (`Geist`, `Geist_Mono`) downloads `.woff2` from `fonts.gstatic.com` **at build time**. Any network blip fails the build, so the gate — which runs `next build` on every push — is non-deterministic. A flaky gate violates the harness contract ("exit code is law").
- **Fix:** Swapped to Vercel's `geist` package (`geist/font/sans`, `geist/font/mono`) — fonts are **bundled** in the package, zero build-time fetch. Sets the same `--font-geist-sans` / `--font-geist-mono` vars `globals.css` already used, so it was a drop-in. Verified deterministic: two consecutive green gates.
- **Prevention:** 2nd occurrence (failed twice in one session) → **promoted to a Tier-1 gate check**: `tests/build/deterministic-fonts.test.ts` asserts no `src` file imports `next/font/google` (the build-time-CDN-fetch API and the Next.js scaffold default). A regression now fails the gate by filename, not by memory.
- **Attempts to green:** 2

## 2026-06-09 — vitest.config.ts — tests (test)

- **Task:** Harness Task 2
- **What failed:** `vitest run` exits 1 on "no test files found" (vitest v4), which would break the gate and CI on the empty scaffold before any tests exist.
- **Root cause:** vitest v4 defaults to a failing exit code when zero test files match.
- **Fix:** Added `passWithNoTests: true` to the vitest config.
- **Prevention:** Documented; the gate is green pre-tests by design.
- **Attempts to green:** 1

## 2026-06-09 — eslint.config.mjs — lint (lint)

- **Task:** Harness Task 3
- **What failed:** The original plan assumed a `FlatCompat` + `next/core-web-vitals` ESLint config.
- **Root cause:** Next.js 16 scaffolds a NEW flat-config format (`eslint-config-next/core-web-vitals` + `/typescript` via `defineConfig` from `eslint/config`). The plan predated this.
- **Fix:** Extended the scaffold's actual config with `typescript-eslint` strict-type-checked + `eslint-config-prettier`, instead of replacing it.
- **Prevention:** When a plan assumes a config format, read the actual scaffolded file first and extend it. This is why the controller verifies independently rather than trusting the plan verbatim.
- **Attempts to green:** 1

## 2026-06-09 — knip.json — dead-code (arch)

- **Task:** Harness Task 4
- **What failed:** Knip flags installed-but-unimported deps (dexie, fake-indexeddb, vitest) as unused on the empty scaffold; the gate runs knip and must be green.
- **Root cause:** Runtime/test deps are installed before the Plan 1 code that imports them exists.
- **Fix:** Added the pending deps to `ignoreDependencies` (temporary) plus permanent CLI-only tooling ignores.
- **Prevention:** TEMPORARY ignores (`dexie`, `fake-indexeddb`, `vitest`, `@vitest/coverage-v8`) must be removed once Plan 1 imports them — see Task 15 cleanup. Tracked in CLAUDE.md.
- **Attempts to green:** 1

## 2026-06-09 — harness — self-test

- **Task:** Harness Task 14
- **What failed:** N/A — verification run.
- **Root cause:** N/A.
- **Fix:** Confirmed the gate FAILS on each violation: `any` (lint), domain→data import (depcruise), bad formatting (format:check), failing test (vitest). 4 caught / 0 missed. Gate green afterward.
- **Prevention:** Gates verified to bite before releasing the loop on Plan 1.
- **Attempts to green:** 1

## 2026-06-09 — docs (markdown) — format (lint)

- **Task:** Harness Task 15 / docs
- **What failed:** `pnpm gate` step 1 (format:check) failed on hand-authored markdown (tables not in Prettier style).
- **Root cause:** Files authored inline aren't Prettier-formatted until lint-staged/`pnpm format` runs.
- **Fix:** Run `pnpm format` (or let pre-commit's lint-staged reformat) BEFORE relying on the gate; committed state is Prettier-clean.
- **Prevention:** When authoring files directly, run `pnpm format` before `pnpm gate`. Never chain commit after gate with `&&` on a non-gate command.
- **Attempts to green:** 1

## 2026-06-09 — knip.json — dead-code (arch)

- **Task:** Plan 1 — types + loadMetrics
- **What failed:** Bottom-up build trips knip: domain modules look like "unused files" (tests were ignored) and types.ts exports look "unused" until later modules consume them.
- **Root cause:** `ignore: tests/**` hid legitimate test consumers; shared types module is a public API surface knip can't see consumers for mid-build.
- **Fix:** Made `tests/**/*.test.ts` knip entries (tests are real consumers) and added `src/domain/types.ts` as an entry (type API surface).
- **Prevention:** RECURRING (2nd knip issue) → promoted: knip config now treats tests + types module as entries. Documented here + in knip.json.
- **Attempts to green:** 2

## 2026-06-09 — periodization + config — lint/type/coverage

- **Task:** Plan 1 — periodization
- **What failed:** 4 gate catches: (1) strict-type-checked banned numbers in template literals; (2) noUncheckedIndexedAccess made array-indexing test code fail tsc while strict bans `!`; (3) domain coverage <95% (untested 2/4-session rotations); (4) type-coverage --strict counts `!` as unsafe.
- **Root cause:** The plan's test code predates the strict tsconfig/eslint; strict tooling is aggressive on idioms.
- **Fix:** (1) `restrict-template-expressions: { allowNumber: true }`; (2) eslint override allows `!` in tests/**; (3) added 2/4-session tests; (4) type-coverage ignores tests/** (tsc + eslint already cover them).
- **Prevention:** Config now matches our idioms; future domain tests inherit these. Domain code keeps full strictness.
- **Attempts to green:** 4

## 2026-06-09 — bootstrap/page — vitest alias + knip cleanup

- **Task:** Plan 1 — bootstrap, UI, cleanup
- **What failed:** (1) vitest couldn't resolve `@/` value imports (only type imports were erased); (2) repo impl `_id` rest-omit tripped no-unused-vars.
- **Root cause:** vitest lacked the tsconfig `@/*` alias; no-unused-vars lacked ignoreRestSiblings.
- **Fix:** Added `resolve.alias['@']` to vitest.config; added no-unused-vars `{ ignoreRestSiblings, _-prefix }`. Removed resolved temp knip ignores; e2e smoke passes (app renders).
- **Prevention:** Config now supports the alias + idioms for all future modules. Knip ignores kept to CLI-only tooling.
- **Attempts to green:** 2

## 2026-06-09 — repo structure / tooling — openness

- **Task:** Harness — make it self-contained + tool-agnostic
- **What changed:** Docs lived OUTSIDE the repo (`../docs/superpowers/`), untracked and undiscoverable when reading the codebase; harness read as Claude-only.
- **Fix:** Moved docs INTO the repo at `docs/{specs,plans}` + `docs/LEARNINGS.md` (+ `docs/README.md` index). Added `CONTRIBUTING.md` + `.editorconfig`. Elevated `AGENTS.md` as the canonical cross-tool contract (Codex/OpenCode/Cursor/Aider/Claude); documented `.claude/` as optional convenience. Updated all path refs.
- **Prevention:** "The gate is the contract" — enforcement is plain shell+git+CI, tool-independent. Any agent or human contributes the same way. Docs are version-controlled with the code.
- **Attempts to green:** 1

## 2026-06-09 — .github/workflows/ci.yml — CI (infra)

- **Task:** Post-push CI fix
- **What failed:** CI `actions/setup-node` step: "Some specified paths were not resolved, unable to cache dependencies."
- **Root cause:** ci.yml was written for a NESTED layout (`working-directory: boulder-coach`, `cache-dependency-path: boulder-coach/pnpm-lock.yaml`), but `boulder-coach` was pushed AS the repo root, so those paths don't exist.
- **Fix:** Removed `defaults.run.working-directory` and the nested `cache-dependency-path`; setup-node auto-detects the root `pnpm-lock.yaml`.
- **Prevention:** When a project dir becomes the repo root, CI paths must be repo-root-relative. Verified locally; pushing re-triggers CI.
- **Attempts to green:** 1

## 2026-06-09 — ci.yml semgrep — CI (infra)

- **Task:** Post-push CI fix #2
- **What failed:** `pnpm dlx semgrep` → `ERR_PNPM_DLX_NO_BIN` (npm `semgrep` package has no bin; semgrep is a Python tool). Also `--config=auto` requires telemetry on (`--metrics=off` rejected).
- **Root cause:** Wrong installer (npm) for a Python tool; `auto` config needs metrics.
- **Fix:** CI installs `uv` (astral-sh/setup-uv) and runs `pnpm semgrep` = `uvx semgrep --config=p/default --config=p/typescript --error --metrics=off src`. Validated locally: 211 rules, 14 files, 0 findings. Added as a reproducible pnpm script.
- **Prevention:** Pin concrete rulesets (no telemetry, deterministic); use uv for Python tooling per project preference. Local `pnpm semgrep` mirrors CI exactly.
- **Attempts to green:** 2

## 2026-06-09 — skills/ — universal agent skills

- **Task:** Add portable skills for minimal-iteration, highest-quality output
- **What changed:** Best practices lived only as prose (WORKFLOW/AGENT-SKILLS) and Claude-only `.claude/` packaging.
- **Fix:** Added tool-neutral `skills/` (plan-a-change, passing-the-gate, test-driven-development, safety-critical-change, debug-systematically, verify-before-done) readable by ANY agent/model; referenced from AGENTS.md. `passing-the-gate` distills this ledger into first-pass-green rules.
- **Prevention:** Future agents read the matching skill BEFORE the task → clear the gate first try instead of repeating our iterations. This ledger feeds the skills; the skills prevent the ledger from growing for the same reasons.
- **Attempts to green:** 1

## 2026-06-09 — playwright.config.ts — e2e (dynamic)

- **Task:** Plan 2 — e2e
- **What failed:** Playwright hit `net::ERR_EMPTY_RESPONSE` (a stale `pnpm dev` squatting :3000) and then Next 16 Turbopack "Could not find the module … in the React Client Manifest" on parallel first-compile in dev mode.
- **Root cause:** (1) `reuseExistingServer` reused a dead dev server; (2) dev-mode on-demand compilation races under concurrent route requests.
- **Fix:** e2e now serves the PRODUCTION build (`pnpm build && pnpm start`) — no on-demand compile, no races, and it tests what ships. Kill stale :3000 + clear `.next` if it recurs locally.
- **Prevention:** Smoke e2e against production serve, not dev. Documented in passing-the-gate (e2e section could note this).
- **Attempts to green:** 2

## 2026-06-09 — knip.json — self-healing config (various)

- **What happened:** Knip got smarter over time and detected dependencies that were
  listed in `ignoreDependencies` as actually used (eslint-config-prettier,
  typescript-eslint, @tailwindcss/postcss, etc.). Also: `src/app/**/route.ts` pattern
  matched zero files.
- **Root cause:** ignore list grew during bootstrap to suppress warnings; never cleaned up.
- **Fix:** Removed all resolved entries; kept only `tailwindcss` (CLI binary, not imported).
- **Prevention:** Check `knip.json` after each major dep add. Knip's own warnings about
  "Remove from ignoreDependencies" are actionable — act on them.

## 2026-06-09 — drills/page.tsx — lint: no-confusing-void-expression

- **What happened:** Arrow function event handlers `onClick={() => setTab('technique')}`
  were flagged by strict-type-checked ESLint. The arrow returns `void` (from `setTab`),
  which the rule considers confusing.
- **Root cause:** shorthand arrow `() => expr` returns the value of expr. When expr is
  `setTab(...)` which returns `void`, the rule flags the implicit void return.
- **Fix:** Use block body `() => { setTab('technique'); }`.
- **Prevention:** All UI event handlers that call setState must use block-body arrows.

## 2026-06-10 — public/sw.js, manifest, README, CLAUDE.md — cross-model handoff review (gate-blind)

- **Task:** Post-handoff scrutiny of Plan 3 (built by a different model after a session-limit handoff).
- **What failed:** Four defects the gate cannot see, all green on `pnpm gate`:
  (1) `sw.js` was cache-first for HTML navigations + a static worker whose bytes never
  change between deploys → users pinned to the v1 app shell forever (no update path);
  (2) `manifest.webmanifest` had `"icons": []` → not installable as a PWA;
  (3) `CLAUDE.md` "Knip ignores" + `README.md` architecture drifted from the new code
  (5 routes, `insights.ts`/`drills.ts`, the service worker were undocumented);
  (4) redundant `ignore: ["e2e/**"]` in knip.json (knip's own hint flagged it).
- **Root cause:** The gate validates types/coverage/architecture/dead-code/build. It is
  blind to (a) runtime behavior of untyped static assets (`sw.js`), (b) data-only files
  (manifest), and (c) doc-vs-config semantic drift. Doc discipline was also skipped in the
  handoff commits.
- **Fix:** `sw.js` → network-first navigations (fresh app for online users) + cache-first
  for immutable `/_next/static/*` + `clients.claim()` + per-URL precache (non-atomic) +
  `CACHE = v2` bump; manifest gets an `icon.svg` (`sizes: any`, maskable); registration
  defers to `load` and swallows rejection; README/CLAUDE.md synced; knip ignore removed.
- **Prevention:** After ANY cross-tool/cross-model handoff, run this review checklist on the
  delta: service worker fetch strategy (navigations must be network-first), manifest icons
  present, and README/CLAUDE.md/AGENTS.md reflect new routes+modules. A green gate is
  necessary, not sufficient — gate-blind surfaces (PWA assets, manifests, docs) need a human/
  second-model pass.
- **PROMOTED → Tier 1:** the manifest-icons + SW-network-first lessons are now executable in
  `tests/pwa/manifest.test.ts` (runs inside the gate). This bug class can no longer recur via a
  memoryless agent — it's blocked by the gate, not by remembering. Next promotion candidate:
  Lighthouse-PWA e2e assertion. Handoff system that carries this forward: `pnpm onboard` +
  `docs/HANDOFF.md` + `AGENTS.md` → "START HERE / Definition of done".
- **Attempts to green:** 1 (only formatting: prettier reflowed sw.js).

## 2026-06-10 — src/app/session/page.tsx — review (cross-agent quality)

- **Task:** BC-04 — session player grade capture (reviewing a memoryless cross-agent handoff).
- **What failed:** First-pass `bumpGrade(blockId, field, delta)` modelled grades as a `VGrade[]`
  you append to: the `−` button appended `lastGrade − 1` instead of decrementing a count, so the
  arrays only ever GREW and a tally could never go down. The clean, already-tested `expandTally`
  helper sat unused in production (imported only by its own test, so knip stayed green). A green
  gate did not catch any of it — React components here have no RTL/jsdom harness, so logic left
  inside the component is gate-blind.
- **Root cause:** wrong data structure (sequence instead of a tally) + logic placed in the
  un-tested component layer instead of a covered `app/lib` helper.
- **Fix:** rewrote capture as a per-grade `{grade: count}` tally that calls `expandTally` at save
  time (so `−` is `Math.max(0, n−1)`); added the AC's missing end-to-end integration test
  (`tests/domain/sessionCapture.test.ts`) covering tally → log → repo → Insights pyramid.
- **Prevention:** keep regression-critical decisions in `src/app/lib/**` (coverage-measured), not
  in the component. When a tested helper exists, the component MUST use it — an "unused" tested
  helper is a smell that the component re-implemented (and likely mis-implemented) the logic.
- **Attempts to green:** 1 (formatting only).

## 2026-06-10 — src/domain/adaptation.ts — safety (process gap)

- **Task:** BC-05 — progression rules 6–7 (reviewing a cross-agent commit).
- **What failed:** `adaptation.ts` (a safety file) was committed WITHOUT the mandated
  `safety-rule-reviewer` approval — the cross-tool agent had no equivalent step. The rules
  themselves were sound (retroactive review: PASS), but the protocol was bypassed.
- **Root cause:** the "review safety files before commit" rule lives in `CLAUDE.md`/`AGENTS.md`
  (Tier-2 prose), not in an executable gate — a memoryless agent on another tool won't run it.
- **Fix:** ran `safety-rule-reviewer` retroactively (PASS); recorded the result in `BACKLOG.md`.
- **Prevention:** Tier-2 only. Candidate promotion if it recurs: a pre-commit hook that blocks a
  commit touching `adaptation.ts`/`loadMetrics.ts` unless a review marker is present. Until then,
  any agent editing a safety file MUST run the reviewer (or the spec-table self-check in
  `skills/safety-critical-change.md`) before committing.
- **Attempts to green:** n/a (review, not a gate failure).

## 2026-06-10 — src/domain/schedule.ts — coverage (unreachable branch)

- **Task:** BC-03 follow-up — schedule.ts was at 75% branch (below the 90% domain bar; passed only
  on the domain _aggregate_).
- **What failed:** `week.sessions[slot % length] ?? restSession(...)` — with the `% length` wrap the
  index is always valid, so the `?? restSession` branch was unreachable dead code that could never
  be covered. It existed only to satisfy `noUncheckedIndexedAccess`.
- **Root cause:** a `% length` wrap masked the only sensible "no session for this slot" case and
  left a defensive fallback that no test could reach.
- **Fix:** dropped the wrap — a training weekday with no planned session (more `availableWeekdays`
  than session types) now resolves to REST (never a fabricated repeat), which is both safer and a
  reachable, tested branch. schedule.ts → 100% branch.
- **Prevention:** prefer index forms whose undefined case is _meaningful and testable_ over a
  `% length` that hides it behind an unreachable `??`. Per-file branch gaps under the domain bar
  can hide on the aggregate — spot-check new domain files individually.
- **Attempts to green:** 1.

## 2026-06-10 — gate (universal quality enforcement) — promotion

- **Task:** make ANY provider/model produce highest-quality code (the DeepSeek green-but-buggy commit).
- **What failed (root):** the gate had three holes a careless/cheap model fell through — (1) coverage
  thresholds checked on the **aggregate**, so a 75%-branch file hid behind 100% siblings; (2) logic in
  **gate-blind** `page.tsx` components (no React harness) was untested (the `bumpGrade` bug); (3) the
  safety review was **Tier-2 prose + a Claude-only agent**, which a different tool simply skips.
- **Fix (each hole → an executable check, tool-neutral):**
  - **Per-file coverage** — `vitest.config.ts` `thresholds.perFile: true`. Proven: injecting one
    uncovered branch into a domain file now fails the gate _by filename_. Brought `insights.ts` 75→100.
  - **Executable safety invariants** — `tests/domain/adaptation.invariants.test.ts` fuzzes `adapt()`
    over the full safety input grid (≈3.9k cases) and asserts the rule-table guarantees. Proven:
    weakening the ACWR-high RPE cap 6→8 fails with the offending input. This is the Tier-1 promotion of
    the `safety-rule-reviewer` step — no Claude-specific agent required.
  - **Safety-change guard** — `scripts/check-safety-change.sh` (in `.husky/pre-commit`) surfaces the
    canonical rule table + runs `pnpm test:safety` whenever a safety file is staged. Plain bash/git.
  - **Docs** — `skills/universal-quality-bar.md` (read-first on any tool), wired into `pnpm onboard`;
    AGENTS.md/CLAUDE.md/README synced; "logic belongs in covered layers, not components" made explicit.
- **Prevention:** the three bug classes are now build failures, not review notes. The gate is the
  contract for every tool/model equally.
- **Attempts to green:** 2 (prettier reflow; one `no-unnecessary-condition` on `v ?? 0`).
