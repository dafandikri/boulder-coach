# Development Workflow & Best Practices

How to do high-quality development in this repo — whether you drive an AI agent (Claude Code,
OpenCode, Codex, Cursor, Aider) or hand-code. The goal is **reliable output**: changes that are
correct, safe, reviewable, and don't break later.

This is not generic advice — it's the workflow this codebase was built with and enforces.

---

## The one principle everything follows

> **Make the machine the arbiter of "done," not anyone's judgment.**

People and agents rationalize ("it basically works"). Exit codes don't. So every step below turns a
fuzzy quality goal into a check a computer runs: TDD makes correctness checkable, `pnpm gate` makes
quality checkable, the safety reviewer makes injury-rules checkable, the ledger makes mistakes
one-time. **If it isn't enforced, it will drift.**

---

## The core loop: Spec → Plan → Execute → Verify

Don't jump straight to code. Each stage catches mistakes the next stage would amplify.

1. **Spec (the what & why).** Before building, write down the problem, constraints, and design.
   Decide between approaches _on paper_ where it's cheap. Lives in `docs/specs/`.
2. **Plan (the how).** Break the spec into small, ordered, independently-testable tasks. Each task
   names exact files and includes the test. Lives in `docs/plans/`.
3. **Execute (one task at a time).** TDD each task, gate it, commit it. Never batch ten things into
   one heroic change.
4. **Verify (against the goal, not the task list).** Does the thing actually do what the spec
   promised? Run it. Watch it work. "Tests pass" ≠ "goal met."

For a tiny change, the spec might be one sentence and the plan a single task — but the _order_ still
holds: think, then check your thinking, then build, then confirm.

---

## TDD: red → green → refactor (non-negotiable for logic)

1. **Red** — write the failing test first. Watch it fail for the _right reason_ (not a typo).
2. **Green** — the minimal code to pass. Resist building more than the test demands (YAGNI).
3. **Refactor** — clean it up with the test as your safety net.

Why first: a test written after the code tends to test what the code _does_, not what it _should do_.
Writing it first forces you to define correct behavior before you're attached to an implementation.

**Test behavior, not implementation.** Assert on outputs and observable effects, not internal calls.
**Never weaken a test to make it pass** — if a test seems wrong, stop and question the _code_ first.

---

## The gate is the contract

One command decides if a change is acceptable, identically for every contributor and tool:

```bash
pnpm gate   # format · lint · typecheck · architecture · type-coverage · tests+coverage · dead-code · build
```

- Run it **before every commit**. Green or it's not done.
- It's enforced at four tiers so nothing red slips through: in-loop → pre-commit hook → pre-push hook
  → CI. You can't push red; you can't merge red.
- When it fails, **read the first failure** (the gate runs cheap→expensive on purpose) and fix the
  _root cause_, not the symptom. Don't loosen a rule to get green unless the rule is genuinely wrong
  for the codebase (and then change it deliberately, in its own commit, with a note).

---

## Working with AI agents

The patterns that produce reliable agent output (and why):

- **Small, well-specified tasks.** Give the agent a task it can hold entirely in context: exact files,
  the test, the acceptance criteria. Vague task → vague result. This is the #1 lever.
- **Fresh context per task.** Start a clean agent for each independent task; don't let one long
  conversation accumulate confusion. (Here: a fresh subagent per plan task.)
- **Controller + worker split.** One "controller" coordinates and verifies; "workers" implement single
  tasks. The controller curates exactly the context each worker needs — nothing more.
- **Verify, don't trust the report.** An agent saying "done, all tests pass" is a claim, not a fact.
  Re-run the check yourself (or have a _different_ agent review). The gate is your independent verifier.
- **Feedback loopback.** On failure, hand the agent the _exact_ error output and "fix only this, don't
  weaken tests." Cap retries (≈3), then stop and think — repeated failure means the approach or the
  plan is wrong, not that you should try the same thing again.
- **Escalate on uncertainty.** Tell agents it's always OK to stop and say "this is too hard / I'm
  unsure." Bad work is worse than no work. Safety-critical logic escalates to a human fast.
- **Let the agent ask first.** Surface questions _before_ implementation, not after a wrong build.

**Prompting for best output:** state the goal and the constraints, point to the canonical source
(spec/rule table) instead of paraphrasing, give an example of the expected shape, and say how success
is checked. Specificity in = quality out.

---

## Safety-critical code gets extra gates

Some code can hurt someone if it's wrong (here: the injury-adaptation rules in
`src/domain/adaptation.ts` and `src/domain/loadMetrics.ts`). For that code:

- **100% branch coverage** — every decision path is tested, including boundaries (e.g. exactly `1.3`).
- **Implement from the canonical source**, never from memory — see the rule table in
  `docs/specs/2026-06-09-bouldering-coach-app-design.md`.
- **Independent review** before commit (a dedicated reviewer agent or a second human) that checks the
  diff against the spec, not against "looks reasonable."
- **Bounded autonomy** — never let an automated loop "fix" failing safety logic more than once; escalate.

Match the rigor to the blast radius: not all code needs 100%, but the dangerous code does.

---

## Learn once, never repeat: the ledger

`docs/LEARNINGS.md` is an append-only log: every gate failure → root cause → fix → prevention.

- **Read before you write:** grep it for the files you're about to touch.
- **Append on failure:** capture _why_ it broke and how to prevent it.
- **Promote recurring failures into automated checks:** if the same mistake happens twice, don't just
  fix it again — turn it into a lint rule, a gate step, or a CLAUDE.md/AGENTS.md line so it _can't_
  recur. (That's how this repo's ESLint/knip config got tuned — each rule traces to a real failure.)

This is what makes a codebase get _smarter_ over time instead of relearning the same lessons.

---

## Commit & integration hygiene

- **One logical change per commit**, conventional message (`feat(domain): …`, `fix:`, `chore:`,
  `docs:`, `ci:`). Each commit should pass the gate on its own — that gives you clean, revertable history.
- **Commit often** (per task), so a bad change reverts cleanly without losing good work.
- **Pushing/PRs are a deliberate human decision**, not an automated one. Agents commit locally; a human
  pushes. (Enforced here by config.) Before anything goes public, scan for secrets and confirm intent.
- **CI is the backstop**, not the first line — green locally should mean green in CI.

---

## Keep docs current (part of "done")

When you change infra, design, system behavior, public scripts, or the workflow itself, update the
affected docs **in the same commit**: `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/specs/`, and this
file. Rule of thumb: _if a fresh contributor or agent would be misled by the current docs after your
change, the doc update is required now._ Trivial behavior-preserving tweaks don't need it.

---

## Tool-agnostic by design

None of this depends on a specific AI tool. `AGENTS.md` is the cross-tool instruction set; the gate,
hooks, and CI are plain shell/git/GitHub. Use Claude Code, OpenCode, Codex, Cursor, Aider, or your
hands — the contract is identical. See [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## The short version (checklist)

- [ ] Understand the goal; write or read the spec. Pick an approach deliberately.
- [ ] Break work into small, ordered, testable tasks.
- [ ] For each task: failing test → minimal code → refactor.
- [ ] `pnpm gate` green before committing. Fix root causes, not symptoms.
- [ ] Safety-critical code: 100% branches, canonical source, independent review.
- [ ] Verify the real behavior against the goal — run it.
- [ ] Commit small with a conventional message; don't push without intent.
- [ ] Log failures + lessons; promote repeats into automated checks.
- [ ] Update docs in the same commit when behavior/infra changed.
