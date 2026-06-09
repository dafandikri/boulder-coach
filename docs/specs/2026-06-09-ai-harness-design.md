# AI Harness for AI-First Development — Design Spec

**Date:** 2026-06-09
**Status:** Approved (design) — pending spec review
**Author:** dafandikri
**Companion docs:**

- `docs/superpowers/specs/2026-06-09-bouldering-coach-app-design.md` (what we're building)
- `docs/superpowers/plans/2026-06-09-bouldering-coach-core-engine.md` (the Plan 1 the loop executes)

## Problem

The Bouldering Coach app is a **safety-critical** domain: its rules engine decides whether an
injured climber should load a flagged pulley or wrist. The existing spec and Plan 1 are excellent,
but they rely on the _agent remembering_ to follow TDD, keep the domain layer pure, preserve rule
priority, and never ship `any`. Memory is not enforcement.

We want an **AI harness**: the development control plane + an autonomous, gated build loop that makes
correct, production-grade work the path of least resistance — and makes incorrect work physically
fail a machine check before it can be committed.

## Goal

Deliver a harness that:

1. **Autonomously builds** the Plan 1 core engine, task-by-task, via `subagent-driven-development`.
2. **Gates every task** through deterministic checks (tests, types, lint, architecture, coverage)
   plus a safety-rule review, before any local commit.
3. **Self-heals**: routes each failure back to a fresh subagent with the exact error and retries,
   escalating to the human only on repeated failure or any safety-rule change.
4. **Enforces production quality automatically** at four tiers: in-loop → pre-commit → pre-push → CI.
5. **Encodes the architecture** so the layered design (domain pure, repo seam) is a lint rule, not a hope.

**Non-goals (v1 of the harness):** multi-repo orchestration; remote/cloud agents; auto-push or
auto-PR (explicitly forbidden); GSD `.planning/` migration; performance/load testing.

## Decisions (from brainstorming)

| Decision    | Choice                                                                         | Rationale                                                                                |
| ----------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Loop engine | **Approach A — superpowers `subagent-driven-development`**                     | Reuses proven primitives; the plan already names it; fresh subagent per task = no drift. |
| Checkpoints | **Per-task gates**                                                             | Tight blast radius; stops only on repeated failure or safety-rule change.                |
| Git policy  | **Auto-commit local only; push/PR forbidden**                                  | Honors user CLAUDE.md ("nothing leaves my machine") as a config guarantee, not a hope.   |
| Quality bar | **Production-ready; static + dynamic analysis; highest quality**               | Climber safety + forward-compat depend on it.                                            |
| Enforcement | **Automated, four-tier defense in depth + agent feedback loopback**            | Fast checks early/often; slow checks in CI; failures auto-route back to agents.          |
| Learning    | **Append-only learning ledger + promotion path**                               | Every failure logged; recurring ones graduate into automated checks. Minimize repeats.   |
| Scalability | **Plan-agnostic loop, parallel agents, workspace-ready, affected-only checks** | Same harness drives Plan 2/3+; gate time stays flat as the codebase grows.               |

## Architecture

Two layers: a static **control plane** (the rules of the road) and a runtime **orchestration loop**
(the engine that drives this build).

```
CONTROL PLANE (static config — makes ANY agent behave correctly)
  boulder-coach/
    CLAUDE.md                      # arch invariants, TDD mandate, gate commands, git/design principles
    .claude/
      settings.json                # hooks (Stop-gate) + deny rules (git push / gh pr create)
      agents/
        safety-rule-reviewer.md    # reviews domain diffs vs the spec rule-table
      skills/
        domain-rule-authoring/     # injects canonical ACWR math + the 8-row safety table
    .github/workflows/
      ci.yml                       # CI/CD: full gate + Semgrep + Knip + Playwright on push/PR
    .husky/
      pre-commit                   # fast: lint-staged (format + lint + typecheck staged)
      pre-push                     # full: scripts/gate.sh
    scripts/
      gate.sh                      # deterministic gate (single source of truth, called everywhere)
    .dependency-cruiser.cjs        # layering rules: domain ↛ data ↛ app
    knip.json                      # dead-code / unused-dep config
    vitest.config.ts               # coverage thresholds (safety files = 100% branch)
    eslint.config.mjs              # strict-type-checked, bans `any`
    .prettierrc                    # formatting standard
  docs/superpowers/
    LEARNINGS.md                   # append-only ledger: every failure → root cause → fix → prevention
──────────────────────────────────────────────────────────────────
ORCHESTRATION LOOP (runtime — subagent-driven-development)
  for each task in Plan 1 (Tasks 1–11):
    1. dispatch task → FRESH subagent   (TDD: failing test → minimal impl → refactor)
    2. run scripts/gate.sh              (deterministic; exit code is law)
    3. IF domain file touched → safety-rule-reviewer subagent
    4. git add && git commit (local)    ← never push
    5. FEEDBACK LOOP on any failure (see below)
    6. → next task
```

The split is the point: the **control plane** is what makes a fresh session tomorrow behave; the
**loop** is just today's driver.

## The Deterministic Gate (`scripts/gate.sh`)

Single source of truth, invoked by the loop, pre-push, and CI. Runs in fast-to-slow order so the
cheapest failure surfaces first:

```bash
#!/usr/bin/env bash
set -euo pipefail
pnpm prettier --check .          # 1. formatting standard
pnpm lint                        # 2. ESLint strict-type-checked (bans any)
pnpm exec tsc --noEmit           # 3. type soundness (strict)
pnpm exec depcruise src          # 4. architecture: domain ↛ data ↛ app
pnpm exec type-coverage --at-least 99  # 5. ~100% typed
pnpm test -- --coverage          # 6. dynamic: tests + coverage thresholds
pnpm exec knip                   # 7. dead code / unused deps
pnpm build                       # 8. production build succeeds
```

Exit code is the source of truth. Agents rationalize "basically passing"; `gate.sh` does not.
TDD's intentional **red** phase happens _inside_ the subagent (test written, failing, before impl);
the gate only runs at the **task boundary**, where everything must be green.

### Coverage thresholds (vitest.config.ts)

| Scope                                                                     | Line  | Branch |
| ------------------------------------------------------------------------- | ----- | ------ |
| `src/domain/adaptation.ts`, `src/domain/loadMetrics.ts` (safety-critical) | 100%  | 100%   |
| `src/domain/**` (rest)                                                    | ≥ 95% | ≥ 90%  |
| Everything else                                                           | ≥ 90% | ≥ 80%  |

## Static Analysis Layer

| Tool                                                                     | Enforces                                                                         | Tier             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------- |
| TypeScript `strict` (+ `noUncheckedIndexedAccess`, `noImplicitOverride`) | Type soundness                                                                   | all              |
| ESLint `@typescript-eslint` **strict-type-checked**                      | No `any`, no unsafe casts, code standard                                         | all              |
| Prettier                                                                 | Single formatting standard                                                       | pre-commit, gate |
| **dependency-cruiser**                                                   | Layering: `domain/` imports nothing from `data/`/`app/`; `data/` not from `app/` | gate, CI         |
| **type-coverage**                                                        | ~100% of code is typed (no implicit `any` leaks)                                 | gate, CI         |
| **Knip**                                                                 | No dead code / unused dependencies                                               | gate, CI         |
| **Semgrep**                                                              | Security + anti-patterns (via semgrep plugin)                                    | CI               |

## Dynamic Analysis Layer

| Tool                                  | Enforces                                                           | Tier |
| ------------------------------------- | ------------------------------------------------------------------ | ---- |
| **Vitest** (+ v8 coverage)            | Domain logic correctness; coverage thresholds                      | all  |
| Integration tests (domain end-to-end) | Real rule behavior (per project preference: integration over unit) | all  |
| **Playwright** smoke e2e              | Today screen renders a session end-to-end (real runtime)           | CI   |

## Four-Tier Enforcement (defense in depth)

Same checks, escalating cost, nothing reaches "done" by slipping one gate:

1. **In-loop** (`gate.sh`, orchestrator) — per task, before commit.
2. **Pre-commit** (`.husky/pre-commit` → lint-staged) — fast: format + lint + typecheck on _staged_ files.
3. **Pre-push** (`.husky/pre-push` → `gate.sh`) — full gate runs when the human pushes.
4. **CI/CD** (`.github/workflows/ci.yml`) — full gate + Semgrep + Knip + Playwright on every push/PR.

Note: the agent **cannot** push (denied in `settings.json`); the pre-push hook guards the human's
push, and CI is the backstop for branch protection later.

## The Feedback Loop (self-healing reiteration)

The headline mechanism. Every check emits **structured failure output** (file:line, rule id, message).

```
on gate/check failure:
  capture structured failure output
  re-dispatch to a FRESH subagent:
     { original task spec, exact failure output, "fix ONLY this, do not weaken tests" }
  re-run the failed check
  retry up to N = 3 attempts
  if still failing → STOP, surface full trail (task + all attempts + final error) to human

SPECIAL CASE — safety-rule-reviewer rejection:
  max 1 auto-retry, then ALWAYS escalate to human.
  (Rationale: an unbounded loop could "fix" a safety test by weakening it. Never silently loop on safety.)
```

The "do not weaken tests" instruction is load-bearing: it prevents the classic agent failure of
making a test pass by deleting the assertion.

## Institutional Learning Ledger (`docs/superpowers/LEARNINGS.md`)

Persistent, append-only memory so the harness gets _smarter_ over time instead of repeating
mistakes. Every gate failure, feedback-loop iteration, and safety escalation appends one entry:

```markdown
## 2026-06-09 — adaptation.ts — gate fail (test)

- **Task:** Task 6 (adaptation rules engine)
- **What failed:** ACWR caution test — used `> 1.3` instead of `>= 1.3`, missed the 1.3 boundary.
- **Root cause:** Paraphrased the rule table instead of reading the canonical threshold.
- **Fix:** `>= 1.3`; added boundary test at exactly 1.3.
- **Prevention:** domain-rule-authoring skill now states thresholds as `>=`/`>` explicitly.
- **Attempts to green:** 2
```

**Read before write:** before dispatching each task, the orchestrator greps the ledger for entries
touching the same file/module and includes relevant ones in the subagent brief — so a past mistake
is visible _before_ it's repeated.

**Promotion path (the loop closing on itself):** when the same failure category recurs **≥ 2 times**,
it graduates from passive memory into an automated check:

| Recurring failure              | Promoted to                                                |
| ------------------------------ | ---------------------------------------------------------- |
| Repeated `any` / unsafe cast   | stricter ESLint rule + type-coverage bump                  |
| Repeated layering violation    | new dependency-cruiser rule                                |
| Repeated rule-table paraphrase | sharper `domain-rule-authoring` skill assertion            |
| Repeated missed boundary case  | a checklist line in `CLAUDE.md` + a required boundary test |

This is how "log every mistake" becomes "minimize mistakes": detection → memory → automated
prevention. The ledger also yields a per-session **retrospective** (top failure modes, mean attempts
to green, escalation count) to track whether quality is trending up.

## Safety-Rule Reviewer Agent (`.claude/agents/safety-rule-reviewer.md`)

Triggers whenever `adaptation.ts` or `loadMetrics.ts` changes. Checks the diff against the spec's
exact rule table:

- Rule **priority order** preserved: pain → soreness → ACWR-high → ACWR-caution → fatigue → progress → default.
- Pain flag → main volume cut 50% **and** grip forced open-hand **and** prehab inserted **and** `warmupMandatory = true`.
- ACWR thresholds **exactly**: `> 1.5` force-deload; `1.3–1.5` cap intensity (off-by-one here is a real injury risk).
- Every change still carries a human-readable `reason`.
- Soreness (no pain) → grip swap to open-hand, intensity −1.

Deviation → loop stops, surfaces to human. This is the one place we refuse full autonomy, by design.

## `domain-rule-authoring` Skill

A project skill that injects the spec's canonical ACWR formulas and the 8-row rule table directly
into the subagent building `adaptation.ts`/`loadMetrics.ts`, so it implements from the source of
truth instead of paraphrasing.

## Design Principles (encoded in `boulder-coach/CLAUDE.md`)

- **YAGNI** — simplest solution today (per user global CLAUDE.md).
- **Layered architecture invariants** — domain pure (no I/O), repo seam (`IClimbRepo`) is the only
  storage coupling; enforced by dependency-cruiser, not vibes.
- **TDD red-green-refactor mandatory** — every task: failing test first.
- **No `any`** — enforced by ESLint + type-coverage.
- **Test/mock/dummy markers** in test data (per user global CLAUDE.md).
- **Conventional commits** — `feat(domain): …`, matching Plan 1's commit messages.
- **Integration over unit tests** where they catch more (per user global CLAUDE.md).

## Git & Autonomy Policy (config, not memory)

- `git add` + `git commit` — **allowed** autonomously, per task, after a green gate.
- `git push`, `gh pr create` — **denied** via `.claude/settings.json` deny rules. A confused agent
  physically cannot push.
- `git init` runs first (no repo exists yet).
- Commit style: conventional commits, one commit per Plan 1 task (matches the plan).

## Bootstrapping Order (resolving the chicken-and-egg)

The gate needs a project to run against, which doesn't exist yet:

1. **Build the control plane** — scaffold `boulder-coach/` (Plan 1 Task 1) + drop in `CLAUDE.md`,
   `.claude/`, `gate.sh`, all quality config, husky hooks, CI workflow.
2. **Verify the harness against itself** — run `gate.sh` on the empty scaffold; it must pass
   (no tests yet is OK) and CI must be green. Prove the gates work before trusting them.
3. **Release the loop** — run `subagent-driven-development` over Plan 1 Tasks 2–11, each task fully
   gated and feedback-looped.

## Testing Strategy (of the harness itself)

- **Gate self-test:** intentionally introduce a violation of each kind (an `any`, a domain→data
  import, a failing test, a coverage drop, a formatting error) and confirm `gate.sh` fails on it.
  Proves each enforcement actually bites.
- **Feedback-loop test:** dispatch a task that fails once on purpose; confirm the loop captures the
  error, re-dispatches, and recovers.
- **Safety-escalation test:** make a safety-rule deviation; confirm the loop stops and escalates
  rather than auto-fixing.
- **Ledger test:** force a failure; confirm an entry is appended with root cause + prevention, and
  that the next task brief surfaces it (read-before-write).
- **Parallel-dispatch test:** confirm independent domain modules can build concurrently without
  cross-contaminating state or commits.

## How the harness addresses each requirement

| Requirement (from user)                | Harness mechanism                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| CI/CD                                  | `.github/workflows/ci.yml` (full gate + Semgrep + Knip + Playwright)                    |
| Pre-commit + pre-push hooks            | husky `.husky/pre-commit` (lint-staged) + `.husky/pre-push` (gate.sh)                   |
| Testing / TDD enforced                 | subagent TDD contract + coverage thresholds + integration tests                         |
| Production-ready code                  | `pnpm build` in gate; four-tier enforcement                                             |
| Static analysis                        | TS strict, ESLint strict-type-checked, dependency-cruiser, type-coverage, Knip, Semgrep |
| Dynamic analysis                       | Vitest + coverage, Playwright e2e                                                       |
| Linting / standard code                | ESLint + Prettier, enforced pre-commit + CI                                             |
| Best design principles / system design | Layered invariants encoded + enforced by dependency-cruiser                             |
| ENFORCE AUTOMATED                      | Four-tier defense in depth; exit-code gates; settings.json deny rules                   |
| LOOPBACK FEEDBACK TO AGENTS            | Structured failure → fresh subagent → retry ≤3 → escalate                               |
| Log mistakes/failures/learnings        | Append-only `LEARNINGS.md` ledger, read-before-write                                    |
| Minimize mistakes / optimize success   | Promotion path: recurring failure → automated check                                     |
| Make it scalable / room to grow big    | Plan-agnostic loop, parallel agents, workspace-ready, affected-only checks              |

## Scalability (room to grow big)

The harness must scale along three axes without a rewrite.

**1. Plan-agnostic loop.** The orchestration loop is generic over _any_ plan in
`docs/superpowers/plans/`, not hardcoded to Plan 1. Plan 2 (check-in UI + session player), Plan 3
(insights/offline/history), and beyond reuse the identical gate + feedback + ledger machinery. Adding
a feature = write a spec → write a plan → release the same loop. The loop reads tasks by their
`- [ ]` checkbox structure, so it works on every plan that follows the writing-plans format.

**2. Parallel agents for independent work.** Sequential-by-default (TDD per module), but independent
tasks dispatch in parallel via `superpowers:dispatching-parallel-agents`. In Plan 1, `loadMetrics`,
`warmup`, and `periodization` have no shared state and can build concurrently; `adaptation` (depends
on their types) and the repo/bootstrap tasks run after. A dependency note per task tells the loop
what may parallelize. This is what lets a large plan finish without a linear time blow-up.

**3. Workspace-ready + affected-only checks.** Structure is pnpm-workspace-ready from day one so the
app can grow into `apps/web`, `apps/mobile`, `packages/domain`, `packages/cloud-repo` without moving
the harness:

| Growth                    | Path                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| App → app + cloud backend | New `IClimbRepo` impl package behind the existing seam (already designed)                                                   |
| Single app → monorepo     | Promote `boulder-coach/` to a pnpm workspace; `gate.sh` runs per-package                                                    |
| Codebase grows, CI slows  | **Affected-only**: `vitest --changed`, lint-staged, dependency-cruiser on changed paths, Turborepo-style task caching in CI |
| More contributors/agents  | CI + branch protection become the shared backstop; the ledger is shared institutional memory                                |

The principle: **gate _thoroughness_ is constant; gate _time_ scales with the change, not the
codebase.** A one-file change runs a one-file gate; CI runs the full sweep.

## Open Risks

- **Tooling weight vs. YAGNI:** seven static tools is a lot for a solo app. Mitigation: all run from
  one `gate.sh`; config is one-time; the safety domain justifies the rigor.
- **Coverage 100% on safety files** can incentivize trivial tests. Mitigation: safety-rule-reviewer
  checks _behavioral_ correctness, not just coverage %.
- **Feedback loop runaway cost:** bounded by N=3 retries and hard safety escalation.
- **Ledger rot:** an append-only log can grow noisy. Mitigation: per-session retrospective summary +
  promotion of recurring entries into checks (so resolved patterns leave the active surface).
- **Premature scalability (YAGNI tension):** workspace/monorepo is a _path_, not built day one — the
  spec keeps the single-package layout now and only documents the promotion route, avoiding over-engineering.
