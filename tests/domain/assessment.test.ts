import { describe, it, expect } from 'vitest';
import { assessBenchmark, SESSIONS_TO_CONFIRM, LOOKBACK_DAYS } from '../../src/domain/assessment';
import type { SessionLog, VGrade } from '../../src/domain/types';

// BC-27 — re-measure the climber's baseline from recent sends. `currentGrade` is
// set once at onboarding and never re-measured, so after weeks of clean sends the
// program still scales as if they were a level lower. This pure rule derives a
// measured grade from the logs (highest grade SENT in >= SESSIONS_TO_CONFIRM
// distinct sessions, within a recent window) and only flags a level-UP — never a
// silent demotion. asOf-driven, no I/O.

const asOf = new Date('2026-06-13T12:00:00Z');

function daysAgo(n: number): string {
  return new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

/** A minimal mock session log that sent the given grades in one block. */
function mockLog(date: string, gradesSent: VGrade[]): SessionLog {
  return {
    id: `mock-log-${date}`,
    date,
    warmupCompleted: true,
    blocks: [
      {
        blockId: 'mock-block',
        setsCompleted: 1,
        gradesAttempted: gradesSent,
        gradesSent,
        rpe: 7,
      },
    ],
    sessionRPE: 7,
    durationMin: 60,
  };
}

describe('assessBenchmark (BC-27)', () => {
  it('measures the highest grade sent in enough distinct sessions', () => {
    const logs = [mockLog(daysAgo(2), [6]), mockLog(daysAgo(5), [6])];
    const result = assessBenchmark({ logs, currentGrade: 5, asOf });
    expect(result.measuredGrade).toBe(6);
    expect(result.leveledUp).toBe(true);
  });

  it('does not confirm a grade sent in only one session', () => {
    const logs = [mockLog(daysAgo(2), [6]), mockLog(daysAgo(5), [5]), mockLog(daysAgo(8), [5])];
    const result = assessBenchmark({ logs, currentGrade: 5, asOf });
    // V6 sent once (not confirmed); V5 sent twice → measured V5.
    expect(result.measuredGrade).toBe(5);
    expect(result.leveledUp).toBe(false); // ties current grade, no prompt
  });

  it('returns null when no grade clears the confirmation bar', () => {
    const logs = [mockLog(daysAgo(2), [6])];
    const result = assessBenchmark({ logs, currentGrade: 5, asOf });
    expect(result.measuredGrade).toBeNull();
    expect(result.leveledUp).toBe(false);
  });

  it('returns null for an empty log history (cold start, never NaN)', () => {
    const result = assessBenchmark({ logs: [], currentGrade: 5, asOf });
    expect(result.measuredGrade).toBeNull();
    expect(result.leveledUp).toBe(false);
  });

  it('ignores sends older than the lookback window', () => {
    const logs = [
      mockLog(daysAgo(LOOKBACK_DAYS + 1), [6]),
      mockLog(daysAgo(LOOKBACK_DAYS + 3), [6]),
    ];
    const result = assessBenchmark({ logs, currentGrade: 5, asOf });
    expect(result.measuredGrade).toBeNull();
  });

  it('ignores future-dated logs (clock skew / bad import)', () => {
    const future = new Date(asOf.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const logs = [mockLog(future, [6]), mockLog(future, [6])];
    const result = assessBenchmark({ logs, currentGrade: 5, asOf });
    expect(result.measuredGrade).toBeNull();
  });

  it('ignores unparseable log dates', () => {
    const logs = [mockLog('not-a-date', [6]), mockLog('also-bad', [6])];
    const result = assessBenchmark({ logs, currentGrade: 5, asOf });
    expect(result.measuredGrade).toBeNull();
  });

  it('counts a grade once per session even if sent in several blocks', () => {
    const multiBlock: SessionLog = {
      ...mockLog(daysAgo(2), [6]),
      blocks: [
        { blockId: 'a', setsCompleted: 1, gradesAttempted: [6], gradesSent: [6], rpe: 7 },
        { blockId: 'b', setsCompleted: 1, gradesAttempted: [6], gradesSent: [6], rpe: 7 },
      ],
    };
    // Two blocks in ONE session must not count as two sessions.
    const result = assessBenchmark({ logs: [multiBlock], currentGrade: 5, asOf });
    expect(result.measuredGrade).toBeNull();
  });

  it('never flags a level-up when the measured grade is below current (no auto-demotion)', () => {
    const logs = [mockLog(daysAgo(2), [4]), mockLog(daysAgo(5), [4])];
    const result = assessBenchmark({ logs, currentGrade: 7, asOf });
    expect(result.measuredGrade).toBe(4);
    expect(result.leveledUp).toBe(false);
  });

  it('keeps the highest when several grades are confirmed', () => {
    // Both V6 and V5 are sent in 2 sessions; V6 (seen first) must stay the measure
    // even though a lower confirmed grade is encountered afterwards.
    const logs = [mockLog(daysAgo(2), [6, 5]), mockLog(daysAgo(5), [6, 5])];
    const result = assessBenchmark({ logs, currentGrade: 5, asOf });
    expect(result.measuredGrade).toBe(6);
    expect(result.leveledUp).toBe(true);
  });

  it('exposes the confirmation threshold so callers can describe it', () => {
    expect(SESSIONS_TO_CONFIRM).toBeGreaterThanOrEqual(2);
  });
});
