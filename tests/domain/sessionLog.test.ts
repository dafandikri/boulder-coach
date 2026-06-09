import { describe, it, expect } from 'vitest';
import { createSessionLog, suggestSessionRPE } from '../../src/domain/sessionLog';
import type { BlockActual } from '../../src/domain/sessionLog';

const actuals: BlockActual[] = [
  { blockId: 'm', setsCompleted: 5, gradesAttempted: [5, 5, 6], gradesSent: [5], rpe: 9 },
  { blockId: 'cd', setsCompleted: 2, gradesAttempted: [], gradesSent: [], rpe: 4 },
];

describe('suggestSessionRPE', () => {
  it('returns 0 with no blocks', () => {
    expect(suggestSessionRPE([])).toBe(0);
  });
  it('suggests the hardest block RPE as the session RPE', () => {
    expect(suggestSessionRPE(actuals)).toBe(9);
  });
});

describe('createSessionLog', () => {
  it('assembles a SessionLog with an id, mapped blocks, and the given metadata', () => {
    const log = createSessionLog({
      date: '2026-06-09',
      plannedSessionId: 's1',
      warmupCompleted: true,
      blocks: actuals,
      sessionRPE: 8,
      durationMin: 65,
      notes: 'felt strong',
    });
    expect(log.id).toBe('log-2026-06-09');
    expect(log.date).toBe('2026-06-09');
    expect(log.plannedSessionId).toBe('s1');
    expect(log.warmupCompleted).toBe(true);
    expect(log.blocks).toHaveLength(2);
    expect(log.blocks[0]!.gradesSent).toEqual([5]);
    expect(log.sessionRPE).toBe(8);
    expect(log.durationMin).toBe(65);
    expect(log.notes).toBe('felt strong');
  });

  it('falls back to the suggested session RPE when none is given', () => {
    const log = createSessionLog({
      date: '2026-06-10',
      warmupCompleted: false,
      blocks: actuals,
      durationMin: 40,
    });
    expect(log.sessionRPE).toBe(9); // suggested from blocks
    expect(log.plannedSessionId).toBeUndefined();
  });
});
