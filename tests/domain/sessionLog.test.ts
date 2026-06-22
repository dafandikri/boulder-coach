import { describe, it, expect } from 'vitest';
import {
  createSessionLog,
  suggestSessionRPE,
  clampSentToAttempted,
} from '../../src/domain/sessionLog';
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

  it('defaults the id to log-<date> when none is given (planned-session idempotency)', () => {
    const log = createSessionLog({
      date: '2026-06-09',
      warmupCompleted: true,
      blocks: actuals,
      durationMin: 60,
    });
    // BC-64: the planned-session player passes no id, so re-finishing the same day
    // overwrites (stable id) rather than duplicating.
    expect(log.id).toBe('log-2026-06-09');
  });

  it('uses an explicit id when given, so two logs can coexist on one date (BC-64)', () => {
    // BC-64: a freeform log on a day that already has a planned-session log must not
    // collide with `log-<date>` and overwrite it — the caller supplies a unique id.
    const planned = createSessionLog({
      date: '2026-06-09',
      warmupCompleted: true,
      blocks: actuals,
      durationMin: 60,
    });
    const freeform = createSessionLog({
      id: 'log-2026-06-09-q1',
      date: '2026-06-09',
      warmupCompleted: true,
      blocks: actuals,
      durationMin: 45,
    });
    expect(freeform.id).toBe('log-2026-06-09-q1');
    expect(freeform.id).not.toBe(planned.id);
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

  it('clamps corrupt sends that exceed attempts (BC-65)', () => {
    const corrupt: BlockActual[] = [
      { blockId: 'm', setsCompleted: 3, gradesAttempted: [5, 5], gradesSent: [5, 5, 5, 6], rpe: 8 },
    ];
    const log = createSessionLog({
      date: '2026-06-11',
      warmupCompleted: true,
      blocks: corrupt,
      durationMin: 50,
    });
    // two attempts at 5, three sends at 5 → clamped to 2; no attempts at 6 → clamped to 0
    expect(log.blocks[0]!.gradesSent).toEqual([5, 5]);
  });
});

describe('clampSentToAttempted (BC-65)', () => {
  it('returns an empty array when both inputs are empty', () => {
    expect(clampSentToAttempted([], [])).toEqual([]);
  });

  it('leaves valid sends unchanged', () => {
    expect(clampSentToAttempted([5, 5, 6], [5, 6])).toEqual([5, 6]);
  });

  it('clamps sends per grade to the number of attempts at that grade', () => {
    expect(clampSentToAttempted([5, 5], [5, 5, 5, 6, 6])).toEqual([5, 5]);
  });

  it('drops sends for grades with no attempts', () => {
    expect(clampSentToAttempted([4, 4], [5])).toEqual([]);
  });

  it('preserves order of the input sent array up to the clamp', () => {
    expect(clampSentToAttempted([5, 6, 5, 6], [6, 5, 5, 5, 6])).toEqual([6, 5, 5, 6]);
  });
});
