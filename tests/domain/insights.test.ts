import { describe, it, expect } from 'vitest';
import { computeInsights, summariseInsights, type Insights } from '../../src/domain/insights';
import type { SessionLog, CheckIn } from '../../src/domain/types';

// BC-51 — a deterministic, on-device coaching read over the same Insights data.
const summaryAsOf = new Date('2026-06-13');
function insightsWith(overrides: Partial<Insights> = {}): Insights {
  return {
    gradePyramid: [],
    sorenessTrends: [],
    totalSessions: 5,
    averageSessionRPE: 7,
    ...overrides,
  };
}

describe('summariseInsights (BC-51)', () => {
  it('cold-start: no data yields one honest "log a few sessions" line, never a fake claim', () => {
    const s = summariseInsights(insightsWith({ totalSessions: 0 }), 0, summaryAsOf);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatch(/log|no data/i);
  });

  it('safety leads: a high ACWR (>1.5) is the first sentence', () => {
    const s = summariseInsights(insightsWith(), 1.7, summaryAsOf);
    expect(s[0]).toMatch(/load|ease|rest/i);
  });

  it('safety leads: recent sharp pain leads even when load is normal', () => {
    const s = summariseInsights(
      insightsWith({
        sorenessTrends: [{ date: '2026-06-11', bodyPart: 'pip', severity: 2, type: 'pain' }],
      }),
      1.0,
      summaryAsOf,
    );
    expect(s[0]).toMatch(/pain|physio|settle/i);
  });

  it('caution band (1.3–1.5) is surfaced when there is no red flag', () => {
    const s = summariseInsights(insightsWith(), 1.4, summaryAsOf);
    expect(s.join(' ')).toMatch(/creeping|steady/i);
  });

  it('reads a broad base as ready to push the ceiling', () => {
    const s = summariseInsights(
      insightsWith({
        gradePyramid: [
          { grade: 2, count: 6 },
          { grade: 3, count: 5 },
          { grade: 4, count: 1 },
        ],
      }),
      1.0,
      summaryAsOf,
    );
    expect(s.join(' ')).toMatch(/ready|touch|broad/i);
  });

  it('reads a thin/top-heavy base as needing more volume below the max', () => {
    const s = summariseInsights(
      insightsWith({
        gradePyramid: [
          { grade: 4, count: 1 },
          { grade: 5, count: 1 },
        ],
      }),
      1.0,
      summaryAsOf,
    );
    expect(s.join(' ')).toMatch(/broaden|base/i);
  });

  it('always closes with a consistency line and returns at most 4 sentences', () => {
    const s = summariseInsights(
      insightsWith({
        gradePyramid: [{ grade: 3, count: 2 }],
        sorenessTrends: [{ date: '2026-06-11', bodyPart: 'pip', severity: 2, type: 'pain' }],
      }),
      1.7,
      summaryAsOf,
    );
    expect(s.length).toBeLessThanOrEqual(4);
    expect(s.join(' ')).toMatch(/sessions|consistency/i);
  });
});

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
