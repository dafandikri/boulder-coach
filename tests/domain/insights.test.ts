import { describe, it, expect } from 'vitest';
import { computeInsights } from '../../src/domain/insights';
import type { SessionLog, CheckIn } from '../../src/domain/types';

describe('computeInsights', () => {
  it('returns empty grade pyramid and zero stats with no data', () => {
    const i = computeInsights([], []);
    expect(i.gradePyramid).toEqual([]);
    expect(i.sorenessTrends).toEqual([]);
    expect(i.totalSessions).toBe(0);
    expect(i.averageSessionRPE).toBe(0);
  });

  it('builds grade pyramid from sent grades', () => {
    const logs: SessionLog[] = [
      mockLog('2026-06-09', 7, [
        { blockId: 'm', setsCompleted: 3, gradesAttempted: [5], gradesSent: [5, 5], rpe: 8 },
      ]),
      mockLog('2026-06-11', 8, [
        { blockId: 'm', setsCompleted: 3, gradesAttempted: [6], gradesSent: [6], rpe: 9 },
      ]),
    ];
    const i = computeInsights(logs, []);
    expect(i.gradePyramid).toEqual([
      { grade: 5, count: 2 },
      { grade: 6, count: 1 },
    ]);
    expect(i.totalSessions).toBe(2);
    expect(i.averageSessionRPE).toBe(7.5);
  });

  it('skips soreness/pain entries whose severity is falsy (0 or undefined)', () => {
    const checkIns: CheckIn[] = [
      {
        date: '2026-06-09',
        sleepQuality: 4,
        overallFatigue: 2,
        motivation: 4,
        soreness: { pip: 0, elbow: undefined }, // present keys, no real severity
        pain: { shoulder: 0 },
      },
    ];
    const i = computeInsights([], checkIns);
    expect(i.sorenessTrends).toEqual([]); // nothing recorded for falsy severities
  });

  it('aggregates soreness and pain trends from check-ins', () => {
    const logs: SessionLog[] = [mockLog('2026-06-09', 5, [])];
    const checkIns: CheckIn[] = [
      {
        date: '2026-06-09',
        sleepQuality: 4,
        overallFatigue: 2,
        motivation: 4,
        soreness: { pip: 2 },
        pain: {},
      },
      {
        date: '2026-06-10',
        sleepQuality: 3,
        overallFatigue: 3,
        motivation: 3,
        soreness: {},
        pain: { shoulder: 3 },
      },
    ];
    const i = computeInsights(logs, checkIns);
    expect(i.sorenessTrends).toHaveLength(2);
    expect(i.sorenessTrends[0]).toEqual({
      date: '2026-06-09',
      bodyPart: 'pip',
      severity: 2,
      type: 'soreness',
    });
    expect(i.sorenessTrends[1]).toEqual({
      date: '2026-06-10',
      bodyPart: 'shoulder',
      severity: 3,
      type: 'pain',
    });
  });
});

function mockLog(date: string, rpe: number, blocks: SessionLog['blocks']): SessionLog {
  return {
    id: `log-${date}`,
    date,
    warmupCompleted: true,
    blocks,
    sessionRPE: rpe,
    durationMin: 60,
  };
}
