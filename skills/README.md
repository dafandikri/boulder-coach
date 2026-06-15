# Skills — universal, tool-agnostic procedures for agent developers

These are **portable skills** any agent or human can use — Claude Code, OpenCode, Codex, Cursor,
Aider, or a raw model. They're plain markdown (no tool-specific runtime required) and are referenced
from [`../AGENTS.md`](../AGENTS.md) so every tool picks them up.

## Purpose: highest quality in the fewest iterations

Each skill front-loads knowledge so the work clears `pnpm gate` (and the goal) on the **first pass**
instead of bouncing off it. They are distilled from real failures recorded in
[`../docs/LEARNINGS.md`](../docs/LEARNINGS.md) — using them means you don't repeat the iterations we
already paid for.

## How to use (any tool)

- **Reading a skill before the matching task is the whole point.** About to write tests? Read
  `test-driven-development.md`. About to write code? Read `passing-the-gate.md` first.
- **Claude Code** also reads these via `CLAUDE.md → AGENTS.md`; the optional `.claude/` package adds
  auto-invoked versions of a couple.
- **OpenCode / Codex / Cursor / Aider** read `AGENTS.md`, which points here. You can also wire each
  skill to a custom command/prompt in your tool.
- **Raw model** — paste the relevant skill into the system prompt alongside `AGENTS.md`.

## The skills

| Skill                                                      | Use before…                                    | Saves iterations on…                     |
| ---------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| [`universal-quality-bar.md`](universal-quality-bar.md)     | **anything, on any tool/model**                | the 3 bug classes that ship green        |
| [`plan-a-change.md`](plan-a-change.md)                     | starting any non-trivial work                  | building the wrong thing                 |
| [`passing-the-gate.md`](passing-the-gate.md)               | writing/editing code                           | strict-TS, coverage, knip, alias gotchas |
| [`test-driven-development.md`](test-driven-development.md) | writing tests/logic                            | weak or after-the-fact tests             |
| [`safety-critical-change.md`](safety-critical-change.md)   | touching `adaptation.ts`/`loadMetrics.ts`      | injury-safety bugs, coverage misses      |
| [`debug-systematically.md`](debug-systematically.md)       | fixing a bug/failure                           | guess-and-check thrash                   |
| [`operating-and-deploying.md`](operating-and-deploying.md) | shipping/changing deploy, rollback, monitoring | un-operable releases, a stale runbook    |
| [`verify-before-done.md`](verify-before-done.md)           | claiming "done"                                | shipping unverified work                 |

The order they usually fire: **plan → (tdd + passing-the-gate) per task → verify**, with
`safety-critical-change` layered on for dangerous files and `debug-systematically` whenever something
breaks. See [`../docs/WORKFLOW.md`](../docs/WORKFLOW.md) for the surrounding loop.
