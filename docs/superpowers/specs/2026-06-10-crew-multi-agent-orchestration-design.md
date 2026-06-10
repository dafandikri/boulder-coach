# Crew — Multi-Agent Parallel Orchestration (Design Spec)

**Date:** 2026-06-10
**Status:** design approved (approach), pending spec review
**Author:** brainstormed with dafandikri
**Codename:** Crew

---

## 1. Problem & goals

Boulder Coach is built by **memoryless, tool-neutral agents** (a new session — often a different
model/provider — each time). Today they run **one at a time**. The goal is to run **several agents in
parallel** on this repo to boost throughput, while preserving the properties that make the repo safe
for autonomous work.

### Hard requirements (from the user)

1. **Multiple agents running at the same time** on the repo.
2. **Up-to-date information** for every agent (no stale context).
3. **Environment / infra set up** for each agent before it works.
4. **Minimize merge conflicts.**
5. **Universal agents** — tool-neutral (Claude Code, Codex, OpenCode, Cursor, Aider, or by hand);
   OK to optimize for Claude/Claude Code where it helps, but never to _require_ it.
6. A **manager** that is **adaptive**, not a dumb static dispatcher — but trustworthy/deterministic
   where correctness matters (the user does not trust raw agent judgment for coordination).
7. **Tiered auto-merge:** auto-merge low-risk, 100%-quality work; route risky work to review.
8. A **reviewer agent** that scrutinizes every branch with high accuracy.
9. **Human keeps the upper hand** — override, pause, revert at all times.

### Non-goals (YAGNI for v1)

- No web dashboard (CLI + git log only).
- No cloud/off-machine runners (local worktrees only).
- No long-running daemon (a polling conductor loop, killable any time).
- No event-driven bus (polling is fine at 2–3 workers).

These are documented as **future graduations**, not built now.

---

## 2. Why this fits the existing repo

The hardest prerequisite for multi-agent work — **stateless, repo-resident context** — already exists:

- `pnpm onboard` + `docs/HANDOFF.md` + `docs/LEARNINGS.md` make any fresh agent current in one command.
- `docs/BACKLOG.md` is a **prioritized queue of PBIs** with explicit `Depends on:`, `Complexity:`,
  and `Files:` per item — exactly the metadata a scheduler needs.
- `pnpm gate` is the **merge contract** (`exit code is law`): format → lint → typecheck → depcruise →
  type-coverage → tests+coverage → knip → build.
- Git worktrees are already supported.

Crew is therefore mostly **orchestration on top of what exists**, built in plain git + shell/Node so
it stays tool-neutral — consistent with `AGENTS.md` ("any tool, any agent, or by hand").

---

## 3. Roles

Four roles; only two are LLMs.

| Role              | Implementation                                                                            | LLM?               | Responsibility                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Conductor**     | `scripts/crew/conduct.mjs` (polling loop)                                                 | No                 | Pick work, enforce locks, create worktrees, launch workers, drive merge pipeline. Deterministic backbone.                         |
| **Manager brain** | LLM call at decision points                                                               | Yes (any model)    | "Is this PBI too big — split it?", "which unblocked PBIs parallelize best now?" Adaptation only; never the correctness guarantee. |
| **Worker**        | Any agent in an isolated worktree                                                         | Yes (configurable) | Implement one PBI under the existing TDD + gate contract.                                                                         |
| **Reviewer**      | LLM (maps to existing `code-reviewer` / `safety-rule-reviewer` / `silent-failure-hunter`) | Yes                | Scrutinize a green-gate branch for _correctness_, emit approve/flag verdict.                                                      |

The **human** sits above all roles with an override CLI.

> Design principle: **the script guarantees correctness; the LLM adds adaptation.** Even if the
> manager brain makes a poor call, the deterministic conductor's locks make it impossible for two
> workers to corrupt each other's work.

---

## 4. Conflict minimization (primary design driver)

Three independent layers — a conflict must defeat all three:

1. **Disjoint file-set locking (primary).** Each PBI declares `Files:`. The conductor assigns a PBI
   only if its file set is **disjoint from every active claim**. Two agents never hold the same file
   concurrently → merge conflicts are structurally impossible for the common case. This makes the
   `Files:` field **load-bearing**: a backlog-hygiene pass will ensure every PBI lists accurate files
   (glob-level granularity, e.g. `src/domain/schedule.ts`).
2. **Serial integration.** Branches merge to `main` **one at a time**: rebase candidate on latest
   `main` → re-run `pnpm gate` → merge. No two merges race.
3. **Small units.** The manager brain splits `L`/`XL` PBIs into file-disjoint sub-tasks before
   assignment, keeping locks narrow and branches short-lived.

Trade-off (accepted): when PBIs share files, their parallelism is reduced to serialization. That is
the _correct_ behavior — concurrent edits to e.g. `adaptation.ts` must be forbidden.

---

## 5. State model — git-native (`.crew/`)

No database, no daemon memory. Crash-safe and inspectable via `git log`.

```
.crew/
  config.json              # worker count, per-tool launch adapters, risk tiers
  claims/<pbi-id>.json     # owner, worktree path, branch, locked files,
                           #   lease/heartbeat ts, status (claimed|working|gate-green|review|merging|done|blocked)
  review-queue/<pbi-id>.md # branch awaiting human approval + reviewer verdict
  log.md                   # append-only event log
```

- `BACKLOG.md` remains the single source of truth for **what** to build.
- `.crew/` tracks only **who is doing what right now**.
- Claim creation is an **atomic git operation**, so even two conductors cannot double-assign.

### `config.json` (shape)

```json
{
  "maxWorkers": 3,
  "workerTool": "claude",
  "launchAdapters": {
    "claude": "scripts/crew/adapters/claude.sh",
    "codex": "scripts/crew/adapters/codex.sh",
    "aider": "scripts/crew/adapters/aider.sh"
  },
  "leaseSeconds": 1800,
  "maxGateAttempts": 3,
  "autoMerge": {
    "eligiblePaths": ["src/domain/**", "src/app/lib/**", "docs/**"],
    "requireBranchCoverage": 100,
    "alwaysReview": [
      "src/domain/adaptation.ts",
      "src/domain/loadMetrics.ts",
      "src/app/**/page.tsx",
      "src/app/**/*.tsx",
      "scripts/**",
      "*.config.*",
      "package.json"
    ]
  }
}
```

---

## 6. Integration pipeline (tiered auto-merge + reviewer + override)

```
worker green gate ──▶ Reviewer agent scrutinizes diff
                          │
        ┌─────────────────┴───────────────────┐
   low-risk PBI                          safety / gate-blind UI / infra
   + reviewer APPROVE                    OR reviewer FLAG
        │                                       │
   conductor: rebase on main,            push to .crew/review-queue/
   re-run gate, auto-merge,              + notify human
   update HANDOFF/BACKLOG                       │
        │                                 human: crew approve <pbi> /
   release lock, loop                     crew reject <pbi> / take over
```

**Risk tiers** (from `config.json`, tunable):

- **Auto-merge eligible:** changes confined to `eligiblePaths` (pure `src/domain/**` or
  `src/app/lib/**` at 100% branch coverage, or docs-only) **and** reviewer APPROVE.
- **Always human-reviewed:** safety files (`adaptation.ts`/`loadMetrics.ts`), gate-blind UI
  (`page.tsx`/components), infra (`scripts/`, configs, `package.json`) — **or** any reviewer FLAG.

**Human upper hand:** `crew pause` freezes all merges; every auto-merge is an ordinary git commit
that can be reverted; `crew take-over <pbi>` hands a worktree to the human.

---

## 7. Freshness & per-worktree environment

- **Up-to-date info:** every worker's launch prompt begins with `pnpm onboard` and the worktree
  branches from **current `main`**. After each merge the conductor refreshes `HANDOFF.md`, so the
  next worker to start sees the latest state. Workers never start on stale state.
- **Environment setup:** `scripts/crew/setup-worktree.sh` runs `pnpm install` (fast — pnpm's global
  content-addressed store is shared across worktrees, so it is mostly symlinking), copies any local
  `.env`, and runs a baseline `pnpm gate` smoke check before the worker starts. A worker never begins
  in a broken environment.

---

## 8. Worker contract (tool-neutral)

A worker is any agent handed: `{ worktreePath, pbiId, branch }` plus the **standard charge**:

1. `pnpm onboard`; read `AGENTS.md`, `HANDOFF.md`; grep `LEARNINGS.md` for the PBI's files.
2. Implement the PBI under **TDD** (failing test first), per the existing quality bar.
3. `pnpm gate` must be green.
4. Update `HANDOFF.md` (and `BACKLOG.md` status) as the last step.
5. Signal completion (write a sentinel into `.crew/claims/<pbi-id>.json` → `status: gate-green`).

`scripts/crew/launch-worker.sh` maps this charge to the configured CLI via a per-tool **adapter**, so
adding a new agent tool is one adapter file. Optimizing the Claude adapter (e.g. wiring the
`safety-rule-reviewer` agent) is allowed; it must not become a dependency for other tools.

---

## 9. Error handling

- **Worker crash/hang:** claims carry a **lease + heartbeat**. An expired lease lets the conductor
  reclaim the PBI, tear down the worktree, and re-queue.
- **Repeated gate failure:** after `maxGateAttempts`, the PBI is marked `blocked`, a `LEARNINGS.md`
  entry is appended (root cause if known), and it is surfaced to the human. No infinite retry.
- **Merge conflict despite locks (rare):** abort the merge, re-queue with rebase, flag to human.
- **Reviewer FLAG:** route to the human review queue regardless of risk tier.

---

## 10. Observability

`crew status` renders the live board from `.crew/` + `git worktree list`: each worker, its PBI, gate
state, the pending queue, and the review queue. `.crew/log.md` is the append-only audit trail. A web
dashboard is explicitly out of scope for v1.

---

## 11. Deliverables

- `scripts/crew/conduct.mjs` — conductor polling loop.
- `scripts/crew/claim.mjs` — atomic claim + disjoint-file-lock check.
- `scripts/crew/setup-worktree.sh` — env bring-up + baseline gate smoke.
- `scripts/crew/launch-worker.sh` + `scripts/crew/adapters/*.sh` — per-tool launch.
- `scripts/crew/merge.mjs` — rebase → gate → merge → refresh HANDOFF.
- `scripts/crew/crew` (CLI) — `start` / `status` / `approve` / `reject` / `pause` / `take-over`.
- `.crew/config.json` + a JSON schema for it.
- Manager-brain & reviewer **prompt templates** (tool-neutral) in `.crew/prompts/` or `skills/`.
- **Tests** for orchestrator logic: claim atomicity, disjoint-lock correctness, lease expiry,
  merge-gating, `--dry-run`. (The orchestrator must clear its own gate.)
- Docs: `docs/crew/README.md` runbook; updates to `AGENTS.md` and `HANDOFF.md`.
- Backlog hygiene pass: ensure every PBI has an accurate `Files:` set (now load-bearing).

---

## 12. Scope guards (YAGNI)

- v1: **2–3 workers**, local only, CLI only, polling (not event-driven).
- No daemon, no dashboard, no cloud runners — documented as future graduations.
- Build only what the requirements above need; no speculative abstraction.

---

## 13. Resolved decisions (were open questions; locked at spec review)

1. **Worker default count:** **3** for v1 (`maxWorkers: 3`, configurable).
2. **Infra/`scripts/` changes:** **always human-reviewed** in v1 — they can break every other worker,
   so they never auto-merge regardless of coverage. Revisit once the orchestrator is battle-tested.
3. **Manager brain in v1:** **yes** — the user explicitly wants an _adaptive_ manager. It stays a
   thin, well-scoped LLM call (split `L`/`XL` PBIs; choose the best file-disjoint parallel set). The
   deterministic conductor still owns all correctness guarantees, so a poor brain call cannot corrupt
   work — it only affects scheduling quality.
4. **Git policy:** Crew merges to **local `main`** only; the human pushes (repo rule forbids agent
   `git push`). Auto-merges are ordinary, revertible commits — acceptable and reversible.

```

```
