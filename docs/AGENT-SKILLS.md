# Agent Skills & Capabilities (provider-agnostic)

**Short answer to "do I need the superpowers skill?" — No.**

`superpowers` is a Claude Code _plugin_ that packages good development workflows as invokable "skills."
Those workflows (spec-first, planning, TDD, debugging, review, verification) are **universal best
practices** — not a Claude-only thing. On OpenCode, Codex, Cursor, Aider, or by hand you get the same
outcomes by following the same workflow; the skill is just a convenient package, never a requirement.

**What actually guarantees quality is the harness, not the skill.** `pnpm gate` + the git hooks + CI +
the learning ledger enforce a floor that any contributor — any model, any provider, or a human — must
clear. A stronger model clears it in one pass; a weaker one clears it in five. Neither can ship below
the bar. That's how this repo stays "best output" regardless of who or what writes the code.

```
Skills  →  make an agent BETTER at producing gate-passing work (fewer iterations).  [optional]
Harness →  the FLOOR every change must clear, no matter who wrote it.               [mandatory]
```

---

## The capabilities you actually need (and how to get them anywhere)

Each row is a real development capability. "Claude Code" shows the superpowers skill; the other columns
show how to get the **same capability** elsewhere. The workflow is what matters — see
[`WORKFLOW.md`](WORKFLOW.md) for the how-to of each.

| Capability (what & why)                                      | Claude Code                                                                       | OpenCode / Codex / Cursor / Aider                                                                    | By hand                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Spec-first** — explore requirements & design before coding | `superpowers:brainstorming`                                                       | Prompt the model to produce a spec into `docs/specs/` before code; save as a reusable command/prompt | Write the spec yourself                     |
| **Planning** — decompose into small, ordered, TDD-able tasks | `superpowers:writing-plans`                                                       | Ask for a task-by-task plan into `docs/plans/`; one task = one file + its test                       | Outline tasks in a checklist                |
| **TDD** — red → green → refactor                             | `superpowers:test-driven-development`                                             | Instruct "failing test first"; the **coverage gate enforces it** regardless                          | Write the test first                        |
| **Task execution** — one task at a time, fresh context       | `superpowers:executing-plans`, `subagent-driven-development`                      | Use the tool's agent/subagent/task loop; or run tasks sequentially in fresh sessions                 | Do one task, commit, repeat                 |
| **Parallel work** — independent tasks at once                | `superpowers:dispatching-parallel-agents`                                         | The tool's multi-agent feature, or separate sessions                                                 | Separate branches/worktrees                 |
| **Systematic debugging** — hypothesize, reproduce, isolate   | `superpowers:systematic-debugging`                                                | Prompt the method explicitly; don't let it guess-and-check                                           | Follow the method                           |
| **Independent review** — a second set of eyes vs. the spec   | `superpowers:requesting/receiving-code-review` + the `safety-rule-reviewer` agent | A reviewer agent, a second model, or a human PR review                                               | Self-review against the spec, or a teammate |
| **Verification** — run it, prove it works                    | `superpowers:verification-before-completion`                                      | Prompt "run it and show evidence"; the gate + `pnpm dev`/`pnpm e2e`                                  | Actually run the app                        |
| **Isolation** — work without breaking the workspace          | `superpowers:using-git-worktrees`                                                 | `git worktree` (universal)                                                                           | `git worktree`                              |
| **Find/learn skills**                                        | `superpowers:using-superpowers`                                                   | Read `AGENTS.md` + this file                                                                         | Read the docs                               |

None of the right-hand approaches are worse — they produce the **same gate-passing output**. The skill
just front-loads the workflow so the agent doesn't have to be told each time.

### This repo ships these as portable skill files

You don't have to reinvent the prompts: [`../skills/`](../skills/) contains tool-neutral markdown
versions any agent or model can read directly — `plan-a-change`, `passing-the-gate`,
`test-driven-development`, `safety-critical-change`, `debug-systematically`, `verify-before-done`. They
are distilled from `LEARNINGS.md`, so using them means you skip the iterations we already paid for.
Read the matching skill **before** the matching task. Index: [`../skills/README.md`](../skills/README.md).

---

## How to set up each tool to follow this repo

The shared standard is **`AGENTS.md`** — Codex, OpenCode, Cursor, Aider, Continue, and Claude Code all
read it. It already contains the rules. Per tool:

- **Claude Code** — reads `CLAUDE.md` (which imports `AGENTS.md`) + the optional `.claude/` package
  (the `safety-rule-reviewer` agent, the `domain-rule-authoring` skill, the Stop-gate hook, `LOOP.md`).
  Install the `superpowers` plugin if you want the packaged workflows; it's optional sugar.
- **OpenCode** — reads `AGENTS.md` automatically. Add repo commands that wrap `pnpm gate` / the
  workflow, and use its agent/subagent system for the controller+worker pattern. Works with any
  provider it supports (Anthropic, OpenAI, Google, local, …).
- **Codex (OpenAI)** — reads `AGENTS.md`. Encode the workflow in a project prompt/profile. Whatever
  model is behind it, the gate is the contract.
- **Cursor / Aider / Continue / others** — point their rules at `AGENTS.md` (legacy `.cursorrules` can
  re-export it). Same gate, same result.
- **Any raw model (GPT, Gemini, Llama, local, …)** — paste `AGENTS.md` + the relevant spec into the
  system prompt. The instructions are plain markdown any model can read; the gate enforces the rest.

---

## Why "any provider, any model" still yields the best output

The harness decouples **output quality** from **model strength**:

1. **The gate is deterministic and model-blind.** `pnpm gate` (format · lint · types · architecture ·
   type-coverage · tests+coverage · dead-code · build) doesn't care which model produced the diff. Red
   is red.
2. **Four tiers mean nothing red escapes.** in-loop → pre-commit → pre-push → CI. A model can't talk
   its way past an exit code.
3. **The safety reviewer guards the dangerous code** the same way regardless of author.
4. **The ledger makes the system smarter over time** — recurring mistakes get promoted into automated
   checks, so even a weak model stops repeating them.
5. **Worst case for a weaker model is more iterations, not worse output.** It bounces off the gate more
   times; it cannot ship below the bar.

So you can mix providers freely — brainstorm with one model, implement with another, review with a
third — and the floor never moves. **Pick models for speed/cost/availability; the harness handles
quality.**

---

## The minimum to be productive here (any tool)

1. Read [`AGENTS.md`](../AGENTS.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md), and
   [`WORKFLOW.md`](WORKFLOW.md).
2. For dangerous changes, read the safety rule table in
   [`specs/2026-06-09-bouldering-coach-app-design.md`](specs/2026-06-09-bouldering-coach-app-design.md).
3. Work spec → plan → TDD task → `pnpm gate` green → commit. Verify by running it.
4. Log failures in [`LEARNINGS.md`](LEARNINGS.md); promote repeats into checks.
5. Don't push without intent; keep docs current in the same commit.

That's the entire requirement. The superpowers skills make steps 3–4 smoother on Claude Code, but they
are a convenience on top of a contract that every tool and model already shares.
