---
name: debug-systematically
description: Read when something breaks (a test fails, the gate is red, behavior is wrong). Replaces guess-and-check thrash with a method that finds the root cause fast.
---

# Debug systematically

Guess-and-check is the slowest way to fix a bug. Use the method.

## Steps

1. **Reproduce reliably.** Get a single command or input that fails every time. If you can't reproduce
   it, you can't fix it — make it reproducible first.
2. **Read the actual error.** The first error, the full message, the file:line. For the gate, the
   **first** failing step (it runs cheap→expensive on purpose). Don't skim.
3. **Form one hypothesis** about the root cause — a specific, falsifiable claim ("the alias isn't
   resolved in vitest", not "something's wrong with imports").
4. **Isolate** — shrink to the smallest failing case. Remove variables until only the cause remains.
5. **Test the hypothesis** — change one thing, predict the result, confirm. If wrong, you learned
   something; form the next hypothesis. Don't change five things at once.
6. **Fix the root cause, not the symptom.** A coverage failure isn't fixed by lowering the threshold;
   a type error isn't fixed by `any` or `!`. Ask _why_ the check is unhappy.
7. **Add a regression test** so it can't come back.
8. **Log it** in `docs/LEARNINGS.md` (root cause → fix → prevention). If the same class of bug has now
   happened twice, **promote it into an automated check**.

## Red flags you're thrashing

Changing things hoping one works; widening types/asserts to silence errors; re-running the same thing
expecting a different result. Stop, re-read the error, form a real hypothesis.
