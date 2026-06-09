# Orchestration Loop Runbook (plan-agnostic)

Drives ANY plan in `../docs/superpowers/plans/` task-by-task. Currently targets Plan 1
(`2026-06-09-bouldering-coach-core-engine.md`).

## Per-task protocol

1. Read the next `- [ ]` task. Grep `../docs/superpowers/LEARNINGS.md` for the files it touches; include hits in the brief.
2. Dispatch a FRESH subagent (TDD: failing test → minimal impl → refactor).
3. Run `pnpm gate`. Exit code is law.
4. If a domain safety file changed (`src/domain/adaptation.ts` or `src/domain/loadMetrics.ts`) → invoke the `safety-rule-reviewer` agent. On FAIL: max 1 retry, then STOP + escalate.
5. On gate failure: append a LEARNINGS.md entry, re-dispatch a fresh subagent with the EXACT failure output and "fix ONLY this, do not weaken tests". Retry up to N=3. Persistent → STOP + escalate.
6. If the task made a SUBSTANTIAL change to infra/design/system/scripts/loop, update the affected docs
   (`README.md`, `AGENTS.md`, `CLAUDE.md`, specs, this `LOOP.md`) in the SAME commit. Docs are part of "done".
7. `git add -A && git commit` (conventional message). NEVER push.
8. Next task.

## Parallelization map (Plan 1)

- Parallel-safe (no shared state): `loadMetrics` (Task 3) and `warmup` (Task 4). `periodization`
  (Task 5) imports warmup types — run it after warmup.
- Sequential: `adaptation` (Task 6, needs types) → repo interface + Dexie impl (Tasks 7–8) →
  bootstrap (Task 9) → Today screen (Task 10) → PWA manifest (Task 11).
- Use `superpowers:dispatching-parallel-agents` only for the parallel-safe set.

## Knip cleanup — DONE (Plan 1)

The temporary ignores (`dexie`, `fake-indexeddb`, `vitest`, `@vitest/coverage-v8`) were removed once
Plan 1 code imported them. `knip.json` `ignoreDependencies` now holds only permanent CLI tooling.
When adding a new runtime/test dep, do NOT add it to ignores — let knip verify it's actually imported.

## Escalation

Escalation = stop and ask the human. Never auto-fix safety logic past one retry.
Plan 1 Task 1 (scaffold) is already done by the harness — the loop starts at Plan 1 Task 2.
