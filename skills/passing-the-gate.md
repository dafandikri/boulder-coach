---
name: passing-the-gate
description: Read BEFORE writing or editing code. The project-specific idioms that make code clear `pnpm gate` on the first pass — no `any`, strict TS, coverage, knip, alias gotchas. Distilled from real failures.
---

# Passing the gate on the first pass

`pnpm gate` runs 8 checks, cheap→expensive: **format · lint · typecheck · architecture ·
type-coverage · tests+coverage · dead-code · build**. Exit code is law. Write code that satisfies all
of them up front and you avoid the iteration loop. Each rule below cost at least one real iteration to
discover (see `docs/LEARNINGS.md`).

## Before you run the gate

- Run `pnpm format` first — Prettier rewrites style; otherwise `format:check` fails on hand-authored
  files (Markdown tables especially). Never chain a commit after the gate with `&&` on a non-gate
  command — and never commit while the gate is red.

## TypeScript & ESLint (strict-type-checked — bans `any`)

- **Never use `any`.** Infer, or define a type. `import type { … }` for type-only imports (keeps them
  erased at runtime — also avoids needing a value resolver in tests).
- **`noUncheckedIndexedAccess` is on:** `arr[i]` is `T | undefined`. In **source** (`src/`), narrow with
  a guard — `const x = arr[i]; if (!x) throw …; use x` — **do not use `!`** (non-null assertion is
  banned in src and counts against type-coverage). In **tests** (`tests/`), `!` is allowed (override).
- Numbers in template literals are fine (`` `w${i}` ``) — `restrict-template-expressions` allows numbers.
- Omit object fields with rest + `_`-prefix: `const { id: _id, ...rest } = row;` (allowed via
  `ignoreRestSiblings` + `^_` pattern).

## Architecture (dependency-cruiser)

- `src/domain` must import **nothing** from `src/data` or `src/app` (it's pure — no I/O, no React, no
  `Date.now()`; pass `asOf` in). `src/data` must not import from `src/app`. Violations fail the gate.

## type-coverage

- Source must be ~99% typed. Tests are excluded (they're already type-checked by tsc + ESLint).

## Tests & coverage

- Tests live in `tests/**/*.test.ts`. `@/…` value imports resolve (vitest alias is configured);
  relative imports also work.
- Thresholds: **safety files `adaptation.ts` & `loadMetrics.ts` = 100% branch** — test every branch
  including boundaries (e.g. exactly `1.3`, a `0`/`undefined` flag, an already-open-hand grip). The
  rest of `src/domain` ≥ 95% line / 90% branch; everything else rides a 90/80 global aggregate.
- If a defensive branch is genuinely unreachable, restructure to remove it rather than chasing it; on
  non-safety files the global aggregate usually absorbs a defensive throw.

## Knip (dead code / unused deps)

- Test files and `src/domain/types.ts` are **entry points** (so the things they import count as used).
- **Adding a runtime/test dependency?** Import it in code — do **not** add it to `ignoreDependencies`.
  Only genuinely CLI/config-invoked tooling (prettier, eslint, etc.) belongs there.
- An external **binary** used by a script (e.g. `uvx`) goes in `ignoreBinaries`.

## Build

- `pnpm build` is Next.js **16** (breaking changes vs older Next). If a build/config API surprises you,
  check `node_modules/next/dist/docs/` before guessing.

## If the gate still fails

Read the **first** failure only, fix its **root cause**, re-run. Don't loosen a rule to go green unless
the rule is genuinely wrong for the codebase — then change it deliberately, in its own commit, and add
a `docs/LEARNINGS.md` entry so the fix becomes permanent prevention.
