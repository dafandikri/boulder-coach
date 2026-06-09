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
