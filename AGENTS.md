<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# START HERE — handoff protocol (read before any work)

This repo is built by **memoryless agents** (new session, or a different model/provider/tool each
time). Nobody carries context between sessions — so context lives in the repo and is **surfaced and
enforced**, not remembered. Knowledge has three durability tiers; the goal is always to push a lesson
UP a tier:

1. **Tier 1 — Executable (strongest):** the lesson is a gate check (lint/depcruise/type-coverage/test).
   A repeat is impossible — the gate blocks it. No reading required. See `tests/pwa/manifest.test.ts`.
2. **Tier 2 — Surfaced:** `AGENTS.md` (this file), `docs/HANDOFF.md` (live cursor), `docs/LEARNINGS.md`
   (mistake log). Forced into view by `pnpm onboard` and the session-start hook.
3. **Tier 3 — Procedural:** `skills/`, `docs/WORKFLOW.md` — reduce iterations once engaged.

**Every session, step 0:** run **`pnpm onboard`** (tool-neutral — works in Codex, OpenCode, Cursor,
Aider, Claude Code, or by hand). It prints the required reading, the live cursor, the latest learnings,
and the gate/git state. Then read `docs/HANDOFF.md`, and — **don't read the whole ledger** — pull only
the lessons relevant to what you'll touch: **`pnpm learnings <file-or-keyword>`** (e.g.
`pnpm learnings adaptation.ts`, `pnpm learnings "service worker"`). `pnpm learnings` with no argument
lists the index. The ledger is long-term memory; retrieve from it on demand, never load it whole.

# Definition of done (enforces the WRITE side of the handoff)

A task is not done until the next memoryless agent could continue without you. Before you stop:

- [ ] `pnpm gate` is green (also enforced on Stop, pre-push, and CI — you cannot ship red).
- [ ] **`docs/HANDOFF.md` updated** — current state, next actions, any new gate-blind risk. (LAST step.)
- [ ] **`docs/LEARNINGS.md` appended** for any gate failure or non-obvious gotcha (root cause → fix →
      prevention). If a failure category hit **≥ 2 times, promote it to a Tier-1 gate check** instead of
      writing prose again.
- [ ] Docs synced in the **same commit** if behavior/infra changed (see "Documentation discipline").

# Any tool, any agent, or by hand

This file (`AGENTS.md`) is the **canonical, tool-neutral instruction set** for this repo — the
cross-tool standard read by Codex, OpenCode, Cursor, Aider, Continue, and Claude Code alike. You do
not need any specific AI tool to contribute; a human hand-coding follows the same rules.

The enforcement is tool-independent: `scripts/gate.sh`, the git hooks, and CI are plain shell/git/
GitHub and run identically for everyone. **The gate is the contract** — if `pnpm gate` is green, your
change is acceptable no matter how it was written. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

`.claude/` (a safety-review subagent, a rule-authoring skill, a Stop-gate hook, the loop runbook) is
**optional Claude Code convenience**. Everything it encodes also lives here and in `docs/specs/`, so no
other tool or human is at a disadvantage. The canonical injury-safety rule table is in
`docs/specs/2026-06-09-bouldering-coach-app-design.md`. The full development workflow and best
practices are in `docs/WORKFLOW.md`. Which agent capabilities you need and how to get them in any tool
(Claude Code / OpenCode / Codex / Cursor / Aider / raw models) are in `docs/AGENT-SKILLS.md` — no
specific tool or plugin is required.

**Portable skills:** the [`skills/`](skills/) directory holds tool-neutral, reusable procedures —
**read the matching one before the matching task** to clear the gate on the first pass (fewest
iterations). Start with [`skills/universal-quality-bar.md`](skills/universal-quality-bar.md) **first,
on any tool/model** (it explains the three bug classes the gate now blocks), then
[`skills/passing-the-gate.md`](skills/passing-the-gate.md) before writing any code,
[`skills/test-driven-development.md`](skills/test-driven-development.md) before tests, and
[`skills/safety-critical-change.md`](skills/safety-critical-change.md) before touching `adaptation.ts`
or `loadMetrics.ts`. Index: [`skills/README.md`](skills/README.md).

# Working in this repo (AI harness)

This project is built and maintained under an AI-first quality harness. Before claiming any task done:

- **`pnpm gate` must be green.** It runs format → lint → typecheck → architecture → type-coverage →
  tests+coverage → dead-code → build. Exit code is law. (Details: `README.md`.)
- **Coverage is per-file** (`thresholds.perFile: true`): every file clears its own bar — no hiding a
  weak file behind 100% siblings. An uncovered branch fails the gate by filename. Don't leave
  unreachable defensive branches; restructure so the real case is tested. See
  [`skills/universal-quality-bar.md`](skills/universal-quality-bar.md).
- **Architecture is enforced:** `src/domain` is pure (no I/O) and must not import from `src/data` or
  `src/app`; `src/data` must not import from `src/app`. dependency-cruiser fails the gate otherwise.
- **No `any`** (ESLint strict-type-checked + type-coverage). **TDD**: failing test first.
- **Logic belongs in covered layers** (`src/domain/**`, `src/app/lib/**`), never in gate-blind
  `page.tsx` components (no React test harness here). A tested helper that's unused is a smell — the
  component probably re-implemented it (that's how the `bumpGrade` bug shipped).
- **Safety files** `src/domain/adaptation.ts` and `src/domain/loadMetrics.ts` are guarded
  tool-neutrally: `tests/domain/adaptation.invariants.test.ts` fuzzes the rule-table guarantees (a
  broken safety rule fails the gate on any model), and `.husky/pre-commit` →
  `scripts/check-safety-change.sh` surfaces the canonical rule table + runs `pnpm test:safety` when
  you touch them. Read [`skills/safety-critical-change.md`](skills/safety-critical-change.md) and use
  `domain-rule-authoring`; on Claude, the `safety-rule-reviewer` agent is an additional optional eye.
- **Git (two-tier):** conventional commits. A **supervised session** (human-driven or actively supervised)
  may `git push`, `gh pr create`, and `gh pr merge` — granted via `permissions.allow` in
  `.claude/settings.json`. **Autonomous Crew workers cannot push**: the adapter passes
  `--disallowed-tools "Bash(git push:*)" "Bash(gh pr …)"` per-invocation, which overrides the shared
  allow. Workers commit locally; the conductor merges to local `main`; publishing to the remote is a
  supervised/human action. `main` is protected (PR + green `quality` CI required), so push is never
  an unreviewed path.
- **Learning ledger:** before a task, retrieve its lessons with `pnpm learnings <file-or-keyword>`
  (targeted lookup, not a full read of `docs/LEARNINGS.md`); on any gate failure, append an entry
  (root cause → fix → prevention).

# Parallel work with Crew (optional)

`pnpm crew start` runs several agents in parallel git worktrees, each on a backlog PBI whose `Files:`
set is disjoint from every other active worker — so merge conflicts are structurally avoided. It is
tool-neutral (adapters for claude/codex/aider) and built on plain git + Node. Low-risk, reviewer-
approved branches auto-merge to local `main`; safety/UI/infra (or any reviewer flag) wait in a human
review queue (`pnpm crew status` / `approve` / `reject`). Single-agent work is unchanged — Crew is an
accelerator, not a requirement, and the gate is still the contract for every branch. Because the lock
is the PBI's `Files:` field, every open PBI must declare accurate files (enforced by
`tests/crew/backlog-hygiene.test.ts`). Runbook: `docs/crew/README.md`.

# Documentation discipline (keep docs current)

Documentation is part of "done", not an afterthought. Whenever you make a **substantial** change —
new/changed infrastructure, architecture, system behavior, public scripts, tooling, or the loop/gate
itself — update the affected docs **in the same commit**:

- `README.md` — system architecture, harness infra, scripts, tech stack.
- `AGENTS.md` / `CLAUDE.md` — rules and conventions agents must follow.
- `docs/specs/` — design specs when the design changes.
- `.claude/LOOP.md` — when the loop/gate protocol changes.

Rule of thumb for "substantial": if a teammate or a fresh agent would be misled by the current docs
after your change, the docs change is required now. Trivial code tweaks that don't alter behavior,
interfaces, or infra do not require doc updates.
