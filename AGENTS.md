<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

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
- **Learning ledger:** before a task, grep `../docs/superpowers/LEARNINGS.md` for files you touch; on
  any gate failure, append an entry (root cause → fix → prevention).

# Documentation discipline (keep docs current)

Documentation is part of "done", not an afterthought. Whenever you make a **substantial** change —
new/changed infrastructure, architecture, system behavior, public scripts, tooling, or the loop/gate
itself — update the affected docs **in the same commit**:

- `README.md` — system architecture, harness infra, scripts, tech stack.
- `AGENTS.md` / `CLAUDE.md` — rules and conventions agents must follow.
- `../docs/superpowers/specs/` — design specs when the design changes.
- `.claude/LOOP.md` — when the loop/gate protocol changes.

Rule of thumb for "substantial": if a teammate or a fresh agent would be misled by the current docs
after your change, the docs change is required now. Trivial code tweaks that don't alter behavior,
interfaces, or infra do not require doc updates.
