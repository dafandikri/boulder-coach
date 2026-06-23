import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// Tier-1 guard: the gate's format step MUST stay self-healing locally and strict in CI.
//
// Background: hand-editing docs (BACKLOG/HANDOFF/specs) and tripping `format:check` was the
// single most-recurring inner-loop gate failure (LEARNINGS 2026-06-09, 2026-06-13, 2026-06-23
// — 3×, prose-only every time). The ledger's own promotion rule says "≥2× → promote to an
// automated check," so `scripts/gate.sh` now runs `prettier --write` locally (the trip can't
// happen) and `prettier --check` in CI (an unformatted commit still fails the merge gate).
//
// This test promotes THAT FIX from a comment to an executable contract: if someone reverts the
// gate to a plain `format:check` (re-opening the recurrence) or drops the CI strict path
// (weakening the merge guarantee), the gate fails by name here. We read the real script — the
// single source of truth — not a paraphrase. (LEARNINGS 2026-06-23 "format self-heal".)
const gate = readFileSync(join(process.cwd(), 'scripts/gate.sh'), 'utf8');

/** The format step is the block before "2/9 lint" — keep assertions local to it. */
const formatStep = gate.slice(0, gate.indexOf('2/9 lint'));

describe('gate format step stays self-healing locally + strict in CI', () => {
  it('branches on the CI env var (different behavior local vs CI)', () => {
    expect(formatStep).toMatch(/\$\{CI:-\}/);
  });

  it('uses strict --check in CI so an unformatted commit fails the merge gate', () => {
    expect(formatStep).toContain('pnpm format:check');
  });

  it('auto-fixes locally (prettier --write via `pnpm format`) so the inner loop never trips', () => {
    // `pnpm format` === `prettier --write .`; the negative lookahead excludes `format:check`.
    expect(formatStep).toMatch(/pnpm format(?!:check)\b/);
  });

  it('still runs format as the first gate step (cheap failure surfaces first)', () => {
    expect(gate.indexOf('1/9 format')).toBeLessThan(gate.indexOf('2/9 lint'));
  });
});
