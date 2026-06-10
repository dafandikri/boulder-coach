# Docs

All project documentation lives **inside the repo** so it's discoverable when reading the codebase
(and version-controlled alongside the code it describes).

## Start here (every session, any agent or human)

- Run **`pnpm onboard`** — surfaces the live cursor, latest learnings, and gate/git state in one shot.
- [`HANDOFF.md`](HANDOFF.md) — the **live cursor**: where we are, what's next, and the gate-blind risks
  to watch. A memoryless agent reads this first and updates it last. The cross-tool handoff protocol is
  in [`../AGENTS.md`](../AGENTS.md) → "START HERE" and "Definition of done".

## Specs (the "what" and "why")

- [`specs/2026-06-09-bouldering-coach-app-design.md`](specs/2026-06-09-bouldering-coach-app-design.md)
  — the app: problem, architecture, data model, and the **canonical injury-safety rule table**.
- [`specs/2026-06-09-ai-harness-design.md`](specs/2026-06-09-ai-harness-design.md)
  — the AI development harness: gate, enforcement tiers, safety review, learning loop, scalability.

## Plans (the "how", task-by-task)

- [`plans/2026-06-09-bouldering-coach-core-engine.md`](plans/2026-06-09-bouldering-coach-core-engine.md)
  — Plan 1: the domain engine + Today screen (built).
- [`plans/2026-06-09-checkin-and-session-player.md`](plans/2026-06-09-checkin-and-session-player.md)
  — Plan 2: check-in flow + session player + logging (built).
- [`plans/2026-06-09-insights-and-pwa.md`](plans/2026-06-09-insights-and-pwa.md)
  — Plan 3: insights, history, program calendar, drills library, offline PWA (built).
- [`plans/2026-06-09-ai-harness-setup.md`](plans/2026-06-09-ai-harness-setup.md)
  — building the harness itself (built).

## Workflow & best practices

- [`WORKFLOW.md`](WORKFLOW.md) — how to do high-quality dev/agent work here: the Spec→Plan→Execute→
  Verify loop, TDD, the gate-as-contract, working with AI agents, safety discipline, and the learning
  loop. **Start here if you're new.**
- [`AGENT-SKILLS.md`](AGENT-SKILLS.md) — the capabilities AI agents need (spec, plan, TDD, debug,
  review, verify) and how to get them in **Claude Code, OpenCode, Codex, Cursor, Aider, or any
  model/provider**. Answers "do I need the superpowers skill?" (no) and why the harness keeps output
  best regardless of model.

## Learnings

- [`LEARNINGS.md`](LEARNINGS.md) — append-only ledger: every gate failure → root cause → fix →
  prevention. Recurring failures get promoted into automated checks. **Read before starting a task**;
  grep it for the files you're about to touch.

## How docs stay current

Documentation is part of "done". Any substantial change to infra/design/system updates the relevant
doc in the same commit — see [`../AGENTS.md`](../AGENTS.md) → "Documentation discipline".
