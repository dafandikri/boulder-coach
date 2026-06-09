---
name: plan-a-change
description: Read before starting any non-trivial work. Think before coding — the cheapest iteration is the one you avoid by not building the wrong thing.
---

# Plan a change

The most expensive iteration is building the wrong thing well. Spend a little structure up front.

## Steps

1. **Restate the goal** in one or two sentences. What does success look like, observably?
2. **Spec the what & why** (scale to size — a sentence for small work, a `docs/specs/` file for a
   feature): the problem, constraints, and the chosen approach. If there are 2–3 viable approaches,
   list trade-offs and pick one **on paper** — that's where choosing is cheap.
3. **Decompose into small, ordered tasks.** Each task: one responsibility, exact files to touch, and
   its test. A good task is one you (or an agent) can hold entirely in context. Big plans → `docs/plans/`.
4. **Order by dependency.** Foundations first (types), then units that consume them, then wiring/UI.
   Note which tasks are independent (parallelizable) vs. sequential.
5. **Define "done" per task** — usually "test passes + `pnpm gate` green + committed."

## Why this minimizes iterations

- A wrong assumption caught in the spec costs a sentence; caught after coding it costs a rewrite.
- Small tasks isolate failures — when the gate fails, the cause is obvious because the change is tiny.
- Naming files + tests up front prevents mid-task thrash and makes the work reviewable.

## Right-sizing

Tiny change? The spec is one sentence and the plan is a single task — but still do them in order:
**think → check your thinking → build → confirm.** Don't skip straight to code on anything you can't
fully see in your head.
