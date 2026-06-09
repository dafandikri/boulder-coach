<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

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

# Working in this repo (AI harness)

This project is built and maintained under an AI-first quality harness. Before claiming any task done:

- **`pnpm gate` must be green.** It runs format → lint → typecheck → architecture → type-coverage →
  tests+coverage → dead-code → build. Exit code is law. (Details: `README.md`.)
- **Architecture is enforced:** `src/domain` is pure (no I/O) and must not import from `src/data` or
  `src/app`; `src/data` must not import from `src/app`. dependency-cruiser fails the gate otherwise.
- **No `any`** (ESLint strict-type-checked + type-coverage). **TDD**: failing test first.
- **Safety files** `src/domain/adaptation.ts` and `src/domain/loadMetrics.ts`: use the
  `domain-rule-authoring` skill and get the `safety-rule-reviewer` agent to approve before commit.
- **Git:** local commits only (conventional commits). NEVER `git push` / open PRs — denied by config.
- **Learning ledger:** before a task, grep `docs/LEARNINGS.md` for files you touch; on
  any gate failure, append an entry (root cause → fix → prevention).

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
