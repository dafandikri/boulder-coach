@AGENTS.md

# Boulder Coach — Project Instructions

## Architecture invariants (enforced by dependency-cruiser — do not violate)

- `src/domain/**` is PURE: no I/O, no storage, no React, no Date.now() inside functions (pass `asOf`).
- `src/domain` MUST NOT import from `src/data` or `src/app`.
- `src/data` MUST NOT import from `src/app`. `IClimbRepo` is the only storage seam.
- No circular dependencies.

## Quality bar (every task must pass `pnpm gate` before commit)

`pnpm gate` runs: format (auto-fix locally via `prettier --write`, strict `--check` in CI — BC-70) → lint → tsc --noEmit → depcruise → type-coverage → vitest+coverage → knip → build → bundle-size (BC-36). Heavier checks run as separate CI jobs (not the inner loop): e2e incl. **axe a11y** (BC-37) + **offline/SW/manifest** (BC-16), **Lighthouse budgets** (BC-16, `pnpm lighthouse`), and **Stryker mutation testing** on the safety files (BC-35, `pnpm mutation`).

- NEVER use `any` (ESLint + type-coverage enforce this).
- Coverage is **per-file** (`thresholds.perFile: true`): `adaptation.ts` & `loadMetrics.ts` = 100%
  branch; rest of domain ≥ 92% branch; everything else ≥ 95% branch (floors ratcheted 2026-06-14,
  PR #44 — domain held at 92 by `periodization.ts`'s rest-day defensive defaults). No file hides below the bar behind a
  100%-covered sibling — an uncovered branch fails the gate by filename. Don't leave unreachable
  defensive branches; restructure so the meaningful case is tested.
- **Logic belongs in covered layers** (`src/domain/**`, `src/app/lib/**`), never in gate-blind
  `page.tsx` (no React test harness). An unused tested helper is a smell — use it, don't re-implement.
- TDD mandatory: write the failing test FIRST, watch it fail, then minimal impl, then refactor.
- Integration over unit tests where they catch more (drive the engine end-to-end).
- Test data must include a test/mock/dummy/example marker.

Read [`skills/universal-quality-bar.md`](skills/universal-quality-bar.md) first — it explains the
three bug classes the gate now blocks (aggregate-coverage hiding, logic in gate-blind components,
prose-only safety review) and why each is a build failure, not a review note.

## Safety-critical files

`src/domain/adaptation.ts` and `src/domain/loadMetrics.ts` are guarded **tool-neutrally** so any
model/provider is held to the rule table: `tests/domain/adaptation.invariants.test.ts` fuzzes the
guarantees (a weakened rule fails the gate), and `.husky/pre-commit` → `scripts/check-safety-change.sh`
surfaces the canonical rule table + runs `pnpm test:safety` whenever you touch them. Use the
`domain-rule-authoring` skill; read `skills/safety-critical-change.md`. On Claude, also run the
`safety-rule-reviewer` agent before commit — it's an additional human-judgment eye on top of the
executable invariants, not a substitute the gate depends on.

## Git policy

- Commit per task (conventional commits: `feat(domain): …`). Local commits are allowed.
- **Supervised sessions** (human-driven or actively supervised) **may** `git push`, `gh pr create`,
  and `gh pr merge` — granted by `permissions.allow` in `.claude/settings.json`.
- **Autonomous Crew workers** cannot push or open PRs — the worker adapter passes
  `--disallowed-tools "Bash(git push:*)" "Bash(gh pr …)"` per-invocation, overriding the shared
  `allow`. Workers commit locally only; the conductor merges to local `main`.
- `main` is protected (required `quality` CI + `enforce_admins: true`): every change reaches `main`
  via a PR with a green gate, even from a supervised session.

## Learning ledger

Before starting a task, retrieve its lessons with `pnpm learnings <file-or-keyword>` (targeted lookup —
don't read the whole `docs/LEARNINGS.md`; `pnpm learnings` alone lists the index). The ledger is
long-term memory: pull only what's relevant on demand. On any gate failure, append an entry (see ledger
header for format). Fix from the lesson, not blind retry.

## Knip ignores

`knip.json` `ignoreDependencies` lists only `tailwindcss` — the one dep knip can't trace to a
config/script. The rest of the tooling (prettier, dependency-cruiser, type-coverage, knip, eslint
config, etc.) is detected automatically because knip parses `package.json` scripts and config-file
plugins (ESLint, Playwright, PostCSS), so it sees those binaries as used without an ignore entry.
Add to `ignoreDependencies` only when knip false-flags a genuinely-used dep; never to silence a
genuinely-unused one (delete the dep instead). Playwright e2e specs are covered by knip's Playwright
plugin, so they need no `ignore` entry.

## Documentation discipline (keep docs current)

On any **substantial** change to infra, design, or system behavior, update the affected docs in the
SAME commit: `README.md`, `AGENTS.md`, this `CLAUDE.md`, the specs under `docs/`, and
`.claude/LOOP.md` if the loop/gate changed. Docs are part of "done". See `AGENTS.md` →
"Documentation discipline" for the full rule. Trivial behavior-preserving tweaks don't require doc updates.

## YAGNI

Simplest solution that satisfies the spec + tests. No speculative abstraction.
