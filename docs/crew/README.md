# Crew — running agents in parallel

Crew runs up to `maxWorkers` agents in isolated git worktrees, each on one backlog PBI whose files
are disjoint from every other active worker — so merge conflicts are structurally avoided. It is
tool-neutral (Claude Code / Codex / Aider via adapters) and built on plain git + Node, consistent
with this repo's "any tool, any agent, or by hand" contract.

Spec: [`../superpowers/specs/2026-06-10-crew-multi-agent-orchestration-design.md`](../superpowers/specs/2026-06-10-crew-multi-agent-orchestration-design.md)
Plan: [`../superpowers/plans/2026-06-10-crew-multi-agent-orchestration.md`](../superpowers/plans/2026-06-10-crew-multi-agent-orchestration.md)

## Quickstart

```bash
pnpm crew start            # conductor begins assigning open PBIs to worktrees
pnpm crew status           # live board: workers, queue, review queue, paused state
pnpm crew approve <PBI>    # land a human-review-queue branch on local main
pnpm crew reject <PBI>     # discard a branch + its worktree
pnpm crew pause | resume   # freeze / unfreeze the conductor (merges + assignment)
```

> Run `pnpm crew start` from the **primary working tree on `main`** — the conductor merges there and
> refuses (re-queues) if you're on another branch.

## First run — smoke test before going parallel

The conductor + scheduling logic is fully tested, but the **live agent + git path** only proves out
by running it. Validate on one cheap PBI first:

1. `.crew/config.json` ships with **`maxWorkers: 1`** — leave it for the smoke run.
2. `pnpm crew start`; in another terminal `pnpm crew status`. Watch one PBI go worktree → worker →
   reviewer → auto-merge (or land in the review queue).
3. When that works, bump `maxWorkers` to `3` and restart — now file-disjoint PBIs run in parallel.

**Costs & safety:** each worker is a real agent invocation (tokens), runs **autonomously** (it executes
Bash — tests, gate, local commits — without prompts; see "Worker autonomy" below), and edits code in
its worktree. `pnpm crew pause` freezes everything; every auto-merge is a revertible commit.

## Worker autonomy & permissions

Workers must run the gate and commit unattended, but **not** at the cost of blanket host access. The
Claude adapter runs `--permission-mode acceptEdits` (auto-applies file edits) plus an **allowlist** of
exactly the commands a worker needs — `pnpm gate`/`test`/`install`, `git add`/`commit` — in
`.claude/settings.json` `permissions.allow`. Everything else **fails closed**, and `permissions.deny`
(e.g. `git push`) always wins. This is deliberately an allowlist, not a deny-list with a bypass: a
blanket `bypassPermissions` would hand an autonomous agent full host Bash (network exfiltration,
credential reads, `rm`).

**A git worktree is NOT a security boundary** — same user, filesystem, `~/.ssh`/cloud creds, and
network. The allowlist is the real containment. If you run Crew on **untrusted PBIs or a shared
machine**, run the conductor inside a real isolation boundary (container/VM/firejail with no host
credentials and a restricted network). The `codex` (`exec --full-auto`, a workspace-write sandbox) and
`aider` (`--yes-always`) adapters have their own autonomy models; tune per tool/CLI version, and apply
the same allowlist-or-sandbox principle.

## How conflicts are avoided (three independent layers)

1. **Disjoint file-set locking** — each PBI's `Files:` set is a mutex; a PBI is only assigned when
   its files don't overlap any active claim (`scripts/crew/lib/schedule.mjs`). This makes the
   `Files:` field load-bearing; `tests/crew/backlog-hygiene.test.ts` fails the gate if an open PBI
   has none.
2. **Serial integration** — branches land one at a time: rebase on `main` → full `pnpm gate` →
   fast-forward merge (`scripts/crew/merge.mjs`). No two merges race.
3. **Small units** — the manager brain may split `L`/`XL` PBIs into file-disjoint sub-tasks
   (`scripts/crew/lib/split.mjs`). A split is only honored when it's **safe** — every sub-task file is
   within the PBI's lock, sub-tasks are mutually disjoint, and they completely cover the PBI; otherwise
   it falls back to assigning the whole PBI. So a bad LLM split can never widen or break the lock.

## Trust tiers (who can auto-merge)

- **Auto-merge:** changes confined to `autoMerge.eligiblePaths` (pure `src/domain/**` or
  `src/app/lib/**`, or docs) **and** the reviewer agent returns `APPROVE`.
- **Human review:** safety files (`adaptation.ts`/`loadMetrics.ts`), `.tsx` UI, infra
  (`scripts/`, configs, `package.json`), or any reviewer `FLAG` → `.crew/review-queue/`.

You keep the upper hand: `pnpm crew pause` freezes everything, every auto-merge is an ordinary
revertible commit, and Crew never `git push`es (the human publishes).

## Roles

- **Conductor** (`scripts/crew/conduct.mjs`) — deterministic loop; owns all correctness guarantees.
- **Manager brain** (`scripts/crew/lib/manager.mjs`) — optional LLM; splits big PBIs. Fail-safe.
- **Worker** — any agent, launched per-tool via `scripts/crew/adapters/*.sh`.
- **Reviewer** (`scripts/crew/lib/review.mjs`) — LLM scrutiny of each green-gate branch.

## Config

`.crew/config.json` (validated by `.crew/config.schema.json`): `maxWorkers`, `workerTool`,
`launchAdapters`, `leaseSeconds`, `autoMerge` tiers. To support a new agent tool, add an adapter
in `scripts/crew/adapters/` and point `workerTool` at it.

## State

All in git under `.crew/` for crash-safety and `git log` inspectability. `config.json` +
`config.schema.json` are tracked; `claims/`, `review-queue/`, `log.md`, `PAUSED` are runtime state
(gitignored).
