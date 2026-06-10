import { describe, it, expect } from 'vitest';
import { warmupDone, canFinishSession, expandTally } from '../../src/app/lib/sessionForm';

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
