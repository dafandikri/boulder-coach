import { describe, it, expect } from 'vitest';
import {
  computeInsights,
  summariseInsights,
  pyramidTarget,
  pyramidGaps,
  biggestPyramidGap,
  describePyramidGap,
  loadSeries,
  acwrSeries,
  sorenessFrequency,
  type Insights,
  type GradePyramidEntry,
} from '../../src/domain/insights';
import { computeLoadMetrics } from '../../src/domain/loadMetrics';
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

describe('pyramidTarget (BC-30)', () => {
  it('tops out at the goal grade with a single send and broadens downward', () => {
    // ascending by grade, fewest at the top (goal), more toward the base
    expect(pyramidTarget(5, 5)).toEqual([
      { grade: 3, count: 6 },
      { grade: 4, count: 3 },
      { grade: 5, count: 1 },
    ]);
  });

  it('caps the pyramid depth at five levels when the goal is far above current', () => {
    const t = pyramidTarget(2, 12); // a 10-grade reach
    expect(t).toHaveLength(5); // base no deeper than goal - 4
    expect(t.map((e) => e.grade)).toEqual([8, 9, 10, 11, 12]);
  });

  it('lets the current grade broaden the base below current when the goal is close', () => {
    expect(pyramidTarget(6, 7)).toEqual([
      { grade: 4, count: 10 }, // base = current - 2 = 4
      { grade: 5, count: 6 },
      { grade: 6, count: 3 },
      { grade: 7, count: 1 },
    ]);
  });

  it('never floors the base below VB (-1) for a beginner goal', () => {
    const t = pyramidTarget(0, 0); // V0 goal, base would be -2 → clamped to VB
    expect(t.map((e) => e.grade)).toEqual([-1, 0]); // VB, V0
    expect(t.every((e) => e.grade >= -1)).toBe(true);
  });
});

describe('pyramidGaps (BC-30)', () => {
  const target: GradePyramidEntry[] = [
    { grade: 3, count: 6 },
    { grade: 4, count: 3 },
    { grade: 5, count: 1 },
  ];

  it('computes the per-grade shortfall of actual against target', () => {
    const actual: GradePyramidEntry[] = [
      { grade: 3, count: 2 },
      { grade: 5, count: 1 },
    ];
    expect(pyramidGaps(actual, target)).toEqual([
      { grade: 3, actual: 2, target: 6, shortfall: 4 },
      { grade: 4, actual: 0, target: 3, shortfall: 3 },
      { grade: 5, actual: 1, target: 1, shortfall: 0 },
    ]);
  });

  it('clamps shortfall at zero when actual exceeds target (no negative gaps)', () => {
    const actual: GradePyramidEntry[] = [{ grade: 3, count: 99 }];
    expect(pyramidGaps(actual, target)).toContainEqual({
      grade: 3,
      actual: 99,
      target: 6,
      shortfall: 0,
    });
  });
});

describe('biggestPyramidGap (BC-30)', () => {
  it('returns the grade with the largest shortfall', () => {
    const gaps = pyramidGaps(
      [{ grade: 5, count: 1 }],
      [
        { grade: 3, count: 6 },
        { grade: 4, count: 3 },
        { grade: 5, count: 1 },
      ],
    );
    expect(biggestPyramidGap(gaps)?.grade).toBe(3); // shortfall 6 > 3 > 0
  });

  it('breaks ties toward the lower grade — broaden the base first', () => {
    const gaps = [
      { grade: 4, actual: 0, target: 3, shortfall: 3 },
      { grade: 3, actual: 3, target: 6, shortfall: 3 },
    ];
    expect(biggestPyramidGap(gaps)?.grade).toBe(3);
  });

  it('returns null when every grade meets its target', () => {
    const gaps = [{ grade: 3, actual: 6, target: 6, shortfall: 0 }];
    expect(biggestPyramidGap(gaps)).toBeNull();
  });
});

describe('describePyramidGap (BC-30)', () => {
  it('cold start (no sends) returns an honest "log some sessions" line, never NaN', () => {
    const s = describePyramidGap([], 4, 6);
    expect(s).toMatch(/log/i);
    expect(s).not.toMatch(/NaN/);
  });

  it('names the biggest gap grade when the base is thin', () => {
    const actual: GradePyramidEntry[] = [
      { grade: 6, count: 1 },
      { grade: 5, count: 1 },
    ];
    const s = describePyramidGap(actual, 6, 6);
    expect(s).toMatch(/V4|broaden|base/i);
  });

  it('affirms a complete pyramid when every target is met', () => {
    const actual: GradePyramidEntry[] = [
      { grade: 3, count: 9 },
      { grade: 4, count: 5 },
      { grade: 5, count: 2 },
    ];
    const s = describePyramidGap(actual, 5, 5);
    expect(s).toMatch(/solid|broad|ready/i);
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

// BC-38 — trend series for the Insights charts. asOf is fixed so the windows are deterministic.
const seriesAsOf = new Date('2026-06-15T12:00:00');
function daysBefore(asOf: Date, n: number): string {
  return new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe('loadSeries (BC-38)', () => {
  it('returns one point per day in the window, all zero with no logs (empty-safe, never NaN)', () => {
    const s = loadSeries([], seriesAsOf, 14);
    expect(s).toHaveLength(14);
    expect(s.every((p) => p.load === 0)).toBe(true);
    expect(s.some((p) => Number.isNaN(p.load))).toBe(false);
  });

  it('places a session load on its own day (load = sessionRPE × durationMin), newest last', () => {
    const logs = [mockLog(daysBefore(seriesAsOf, 0), 5, [])]; // today, 5 × 60 = 300
    const s = loadSeries(logs, seriesAsOf, 7);
    expect(s).toHaveLength(7);
    expect(s.at(-1)?.load).toBe(300); // today is the last point
    expect(s.slice(0, -1).every((p) => p.load === 0)).toBe(true);
  });

  it('sums multiple sessions on the same day', () => {
    const logs = [
      mockLog(daysBefore(seriesAsOf, 1), 4, []), // 240
      mockLog(daysBefore(seriesAsOf, 1), 6, []), // 360
    ];
    const s = loadSeries(logs, seriesAsOf, 7);
    expect(s.at(-2)?.load).toBe(600); // yesterday
  });

  it('excludes logs outside the window (older than days) and future-dated logs', () => {
    const logs = [
      mockLog(daysBefore(seriesAsOf, 30), 8, []), // older than a 7-day window
      mockLog(daysBefore(seriesAsOf, -2), 8, []), // future
    ];
    const s = loadSeries(logs, seriesAsOf, 7);
    expect(s.every((p) => p.load === 0)).toBe(true);
  });
});

describe('acwrSeries (BC-38)', () => {
  it('returns one ACWR point per day, all zero with no logs', () => {
    const s = acwrSeries([], seriesAsOf, 14);
    expect(s).toHaveLength(14);
    expect(s.every((p) => p.acwr === 0)).toBe(true);
  });

  it("today's ACWR matches the engine computed asOf today (reuses computeLoadMetrics, not a re-impl)", () => {
    const logs = [
      mockLog(daysBefore(seriesAsOf, 10), 6, []),
      mockLog(daysBefore(seriesAsOf, 3), 7, []),
      mockLog(daysBefore(seriesAsOf, 0), 8, []),
    ];
    const s = acwrSeries(logs, seriesAsOf, 14);
    expect(s.at(-1)?.acwr).toBe(computeLoadMetrics(logs, seriesAsOf).acwr);
  });
});

describe('sorenessFrequency (BC-38)', () => {
  it('returns an empty array with no check-ins', () => {
    expect(sorenessFrequency([], seriesAsOf, 42)).toEqual([]);
  });

  it('counts soreness + pain flags per body part within the window, most-frequent first', () => {
    const checkIns = [
      mockCheckIn(daysBefore(seriesAsOf, 1), { soreness: { pip: 2 } }),
      mockCheckIn(daysBefore(seriesAsOf, 3), { soreness: { pip: 1 }, pain: { shoulder: 2 } }),
      mockCheckIn(daysBefore(seriesAsOf, 5), { pain: { pip: 3 } }),
    ];
    expect(sorenessFrequency(checkIns, seriesAsOf, 42)).toEqual([
      { bodyPart: 'pip', count: 3 },
      { bodyPart: 'shoulder', count: 1 },
    ]);
  });

  it('breaks count ties alphabetically by body part for a stable order', () => {
    const checkIns = [
      mockCheckIn(daysBefore(seriesAsOf, 1), { soreness: { shoulder: 2 } }),
      mockCheckIn(daysBefore(seriesAsOf, 2), { soreness: { elbow: 2 } }),
    ];
    expect(sorenessFrequency(checkIns, seriesAsOf, 42).map((c) => c.bodyPart)).toEqual([
      'elbow',
      'shoulder',
    ]);
  });

  it('ignores flags outside the window (too old) and future-dated check-ins', () => {
    const checkIns = [
      mockCheckIn(daysBefore(seriesAsOf, 60), { soreness: { pip: 2 } }), // too old
      mockCheckIn(daysBefore(seriesAsOf, -1), { soreness: { 'wrist-tfcc': 2 } }), // future
    ];
    expect(sorenessFrequency(checkIns, seriesAsOf, 42)).toEqual([]);
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

function mockCheckIn(date: string, partial: Partial<Pick<CheckIn, 'soreness' | 'pain'>>): CheckIn {
  return {
    date,
    sleepQuality: 4,
    overallFatigue: 2,
    motivation: 4,
    soreness: partial.soreness ?? {},
    pain: partial.pain ?? {},
  };
}
