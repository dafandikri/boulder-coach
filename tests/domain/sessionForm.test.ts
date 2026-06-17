import { describe, it, expect } from 'vitest';
import {
  warmupDone,
  canFinishSession,
  expandTally,
  normalizeTallies,
  ensureSetsForClimbs,
} from '../../src/app/lib/sessionForm';
import type { VGrade } from '../../src/domain/types';

describe('warmupDone', () => {
  it('is true when there are no warm-up blocks to check', () => {
    expect(warmupDone([], new Set())).toBe(true);
  });

  it('is false while any warm-up block is unchecked', () => {
    expect(warmupDone(['wu-1', 'wu-2'], new Set(['wu-1']))).toBe(false);
  });

  it('is true once every warm-up block is checked', () => {
    expect(warmupDone(['wu-1', 'wu-2'], new Set(['wu-1', 'wu-2']))).toBe(true);
  });
});

describe('canFinishSession', () => {
  it('allows finishing when warm-up is not mandatory, even if unchecked', () => {
    expect(canFinishSession(false, ['wu-1'], new Set())).toBe(true);
  });

  it('blocks finishing when warm-up is mandatory and incomplete', () => {
    expect(canFinishSession(true, ['wu-1', 'wu-2'], new Set(['wu-1']))).toBe(false);
  });

  it('allows finishing when warm-up is mandatory and complete', () => {
    expect(canFinishSession(true, ['wu-1'], new Set(['wu-1']))).toBe(true);
  });
});

describe('expandTally', () => {
  it('expands a {grade: count} tally into the flat VGrade[] the log stores', () => {
    const flat = expandTally({ 5: 2, 6: 1 });
    expect(flat.filter((g) => g === 5)).toHaveLength(2);
    expect(flat.filter((g) => g === 6)).toHaveLength(1);
    expect(flat).toHaveLength(3);
  });

  it('is empty for an empty tally and ignores zero/negative counts', () => {
    expect(expandTally({})).toEqual([]);
    expect(expandTally({ 4: 0, 5: -1 })).toEqual([]);
  });
});

describe('normalizeTallies (BC-65)', () => {
  it('bumps attempts to match sends when sends exceed attempts', () => {
    const { attempts, sends } = normalizeTallies({ 6: 3 }, { 6: 5 });
    expect(attempts[6]).toBe(5);
    expect(sends[6]).toBe(5);
  });

  it('bumps attempts when sends exceed attempts', () => {
    const { attempts, sends } = normalizeTallies({ 5: 0 }, { 5: 2 });
    expect(attempts[5]).toBe(2);
    expect(sends[5]).toBe(2);
  });

  it('leaves valid tallies unchanged', () => {
    const { attempts, sends } = normalizeTallies({ 4: 5, 5: 2 }, { 4: 3, 5: 1 });
    expect(attempts).toEqual({ 4: 5, 5: 2 });
    expect(sends).toEqual({ 4: 3, 5: 1 });
  });

  it('clamps negative counts to zero', () => {
    const { attempts, sends } = normalizeTallies({ 4: -2 }, { 4: -1 });
    expect(attempts[4]).toBe(0);
    expect(sends[4]).toBe(0);
  });

  it('handles empty tallies', () => {
    const { attempts, sends } = normalizeTallies({}, {});
    expect(attempts).toEqual({});
    expect(sends).toEqual({});
  });

  it('carries a send-only grade over to attempts', () => {
    const { attempts, sends } = normalizeTallies({}, { 7: 1 });
    expect(attempts[7]).toBe(1);
    expect(sends[7]).toBe(1);
  });

  it('handles an attempts-only grade with no matching sends', () => {
    const { attempts, sends } = normalizeTallies({ 5: 2 }, {});
    expect(attempts[5]).toBe(2);
    expect(sends[5]).toBe(0);
  });

  it('does not mutate the input tallies', () => {
    const attempts: Partial<Record<VGrade, number>> = { 5: 1 };
    const sends: Partial<Record<VGrade, number>> = { 5: 3 };
    normalizeTallies(attempts, sends);
    expect(attempts[5]).toBe(1);
    expect(sends[5]).toBe(3);
  });
});

describe('ensureSetsForClimbs (BC-65 follow-up)', () => {
  it('bumps sets from 0 to 1 when attempts are logged', () => {
    const result = ensureSetsForClimbs(0, { 5: 2 }, {});
    expect(result).toBe(1);
  });

  it('bumps sets from 0 to 1 when sends are logged', () => {
    const result = ensureSetsForClimbs(0, {}, { 5: 1 });
    expect(result).toBe(1);
  });

  it('leaves sets unchanged when no climbs are logged', () => {
    expect(ensureSetsForClimbs(0, {}, {})).toBe(0);
    expect(ensureSetsForClimbs(3, {}, {})).toBe(3);
  });

  it('leaves positive sets unchanged even with climbs logged', () => {
    expect(ensureSetsForClimbs(2, { 5: 10 }, { 5: 3 })).toBe(2);
    expect(ensureSetsForClimbs(1, { 5: 1 }, {})).toBe(1);
  });

  it('treats zero and negative sets the same as zero when climbs exist', () => {
    expect(ensureSetsForClimbs(-2, { 5: 1 }, {})).toBe(1);
  });

  it('ignores undefined tally entries defensively', () => {
    const attempts = { 5: 2, 6: undefined as unknown as number };
    expect(ensureSetsForClimbs(0, attempts, {})).toBe(1);
  });
});
