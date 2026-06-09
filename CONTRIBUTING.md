# Contributing

This project is **open to any contributor** — a human hand-coding, or an AI agent driven by
**Claude Code, OpenCode, Codex, Cursor, Aider, Continue, or anything else.** There is no required
tool. The contract is the same for everyone.

## The one rule: the gate is the contract

Whatever you use to write code, your change is "done" only when the quality gate passes:

```bash
pnpm install
pnpm gate
```

`pnpm gate` (`scripts/gate.sh`) runs, in order — **exit code is law**:

1. `format` — Prettier
2. `lint` — ESLint (typescript-eslint strict-type-checked; `any` is banned)
3. `typecheck` — `tsc --noEmit` (strict)
4. `architecture` — dependency-cruiser (`src/domain` must not import `src/data`/`src/app`)
5. `type-coverage` — ≥ 99% typed
6. `tests` — Vitest + coverage (safety files = 100% branch)
7. `dead-code` — Knip
8. `build` — `next build`

This gate is **plain shell + node** — no AI tool required. It runs identically for everyone, and is
enforced automatically at three more layers so nothing red slips through:

- **pre-commit** hook → format + lint + typecheck on staged files
- **pre-push** hook → full `pnpm gate`
- **CI** (GitHub Actions) → full gate + Semgrep + Playwright

If `pnpm gate` is green locally, your change will pass CI.

For the full reasoning behind this workflow — TDD, working with AI agents, safety discipline, the
learning loop — read [`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## Workflow (same for agents and humans)

1. **TDD** — write a failing test first, watch it fail, then the minimal code to pass.
2. **Keep the layering** — domain is pure (no I/O); the only storage seam is `IClimbRepo`.
3. **Safety-critical files** — `src/domain/adaptation.ts` and `src/domain/loadMetrics.ts` decide
   injury-related load management. They require **100% branch coverage** and must match the canonical
   rule table in [`docs/specs/2026-06-09-bouldering-coach-app-design.md`](docs/specs/2026-06-09-bouldering-coach-app-design.md).
   Do not change them without re-reading that table.
4. **Update docs** when you change infra/design/system behavior (see `AGENTS.md` → Documentation discipline).
5. **Commit** with conventional messages (`feat(domain): …`). Local commits only — pushing/PRs are a
   human decision (and blocked for agents by config).

## Using your tool of choice

- **Any agent** reads [`AGENTS.md`](AGENTS.md) — the cross-tool standard (Codex, OpenCode, Cursor,
  Aider, Continue, Claude Code all read it). That file is the canonical instruction set.
- **Claude Code** additionally gets convenience tooling under `.claude/` (a safety-review subagent, a
  rule-authoring skill, a Stop-gate hook, the loop runbook). These are **optional sugar** — they make
  Claude Code nicer but are not required. Every rule they encode also lives in `AGENTS.md` and the
  specs, so no other tool is at a disadvantage.
- **Hand-coding?** `.editorconfig` keeps whitespace consistent; just run `pnpm gate` before committing.

## Project layout

```
boulder-coach/
  src/domain/     pure TypeScript engine (testable, no I/O)
  src/data/       IClimbRepo seam + Dexie impl
  src/app/        Next.js UI + bootstrap wiring
  tests/          Vitest unit/integration
  e2e/            Playwright smoke
  scripts/gate.sh the quality gate (single source of truth)
  docs/           specs, plans, and the LEARNINGS ledger (all in-repo)
  AGENTS.md       cross-tool agent/contributor instructions
  .claude/        OPTIONAL Claude Code convenience (agent, skill, hooks, loop)
```
