import { describe, it, expect } from 'vitest';
import { computeConsistency } from '../../src/domain/consistency';
import type { SessionLog, UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5,
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

/** A minimal logged session on `date` — only the date matters to consistency. */
function mockLogOn(date: string): SessionLog {
  return {
    id: `mock-log-${date}`,
    date,
    warmupCompleted: true,
    blocks: [],
    sessionRPE: 7,
    durationMin: 60,
  };
}

// BC-59 — weeks are anchored to the PROGRAM week (floor((day − startDate)/7)), the
// same bucket programPosition derives, NOT a rolling 7-day window. So a week resets
// on its program boundary instead of dragging the previous week's tail forward.
//
// Program start = Mon 2026-05-04, so the program weeks are:
//   week 4: 2026-06-01 .. 06-07     week 5: 2026-06-08 .. 06-14
const START = '2026-05-04';
// asOf is mid-week-5 (a Saturday). 40 days since start → currentWeek = floor(40/7) = 5.
const asOf = new Date(2026, 5, 13); // 2026-06-13 (local)

describe('computeConsistency (BC-59 — program-week anchored)', () => {
  it('reports zero done and zero streak for a brand-new climber (no logs)', () => {
    const c = computeConsistency([], profile, START, asOf);
    expect(c.weekDoneCount).toBe(0);
    expect(c.weekTarget).toBe(3);
    expect(c.currentStreakWeeks).toBe(0);
  });

  it('counts sessions logged within the current program week', () => {
    // all in week 5 (06-08..06-14)
    const logs = [mockLogOn('2026-06-08'), mockLogOn('2026-06-10'), mockLogOn('2026-06-12')];
    const c = computeConsistency(logs, profile, START, asOf);
    expect(c.weekDoneCount).toBe(3);
  });

  it('excludes sessions from a prior program week from the done count', () => {
    const logs = [mockLogOn('2026-06-06'), mockLogOn('2026-06-12')]; // week 4, then week 5
    const c = computeConsistency(logs, profile, START, asOf);
    expect(c.weekDoneCount).toBe(1);
  });

  it('ignores future-dated logs', () => {
    const c = computeConsistency([mockLogOn('2026-06-20')], profile, START, asOf);
    expect(c.weekDoneCount).toBe(0);
  });

  // THE BUG: after a full week the next program week must open at 0, not carry the
  // previous week's tail forward via a rolling window (which showed 2/3 at week start).
  it('opens a new program week at 0 even when the prior week was full, streak intact', () => {
    // Prior week (week 4, 06-01..06-07) is full with its sessions at the END of the
    // week; asOf is the FIRST day of week 5 (06-08). A rolling 7-day window would
    // still count those 3 tail sessions → a bogus 3/3 (the reported "2/3"). Program
    // weeks reset on the boundary, so the new week is 0/3 with the streak preserved.
    const weekStart = new Date(2026, 5, 8); // 2026-06-08, first day of week 5
    const logs = [mockLogOn('2026-06-05'), mockLogOn('2026-06-06'), mockLogOn('2026-06-07')];
    const c = computeConsistency(logs, profile, START, weekStart);
    expect(c.weekDoneCount).toBe(0);
    expect(c.currentStreakWeeks).toBe(1); // the completed prior week
  });

  it('counts the current week toward the streak once it meets target', () => {
    const logs = [mockLogOn('2026-06-08'), mockLogOn('2026-06-10'), mockLogOn('2026-06-12')];
    const c = computeConsistency(logs, profile, START, asOf);
    expect(c.currentStreakWeeks).toBe(1);
  });

  it('does NOT break the streak when the current week is still in progress', () => {
    // current week (5) has only 1 session so far (below target), but the prior
    // completed week (4) hit target — the streak holds at 1, it doesn't reset to 0.
    const logs = [
      mockLogOn('2026-06-12'), // week 5, 1 of 3 so far
      mockLogOn('2026-06-01'), // week 4, full
      mockLogOn('2026-06-03'),
      mockLogOn('2026-06-05'),
    ];
    const c = computeConsistency(logs, profile, START, asOf);
    expect(c.weekDoneCount).toBe(1);
    expect(c.currentStreakWeeks).toBe(1);
  });

  it('extends the streak across consecutive completed weeks meeting target', () => {
    const logs = [
      // week 5: 3 sessions
      mockLogOn('2026-06-08'),
      mockLogOn('2026-06-10'),
      mockLogOn('2026-06-12'),
      // week 4: 3 sessions
      mockLogOn('2026-06-01'),
      mockLogOn('2026-06-03'),
      mockLogOn('2026-06-05'),
      // week 3 (05-25..05-31): only 2 — breaks the streak there
      mockLogOn('2026-05-26'),
      mockLogOn('2026-05-28'),
    ];
    const c = computeConsistency(logs, profile, START, asOf);
    expect(c.currentStreakWeeks).toBe(2);
  });

  it('terminates (never loops forever) on a degenerate zero target', () => {
    // sessionsPerWeek can't be 0 in a validated profile, but the pure function must
    // still terminate — the walk is bounded by `week >= 0`, so the streak can never
    // exceed the number of program weeks elapsed since start (currentWeek 5 → ≤ 6).
    const logs = [mockLogOn('2026-06-12'), mockLogOn('2026-06-05'), mockLogOn('2026-05-29')];
    const c = computeConsistency(logs, { ...profile, sessionsPerWeek: 0 }, START, asOf);
    expect(Number.isFinite(c.currentStreakWeeks)).toBe(true);
    expect(c.currentStreakWeeks).toBeLessThanOrEqual(6);
  });

  it('breaks the streak at a week that misses target', () => {
    const logs = [
      mockLogOn('2026-06-08'), // week 5 met target
      mockLogOn('2026-06-10'),
      mockLogOn('2026-06-12'),
      mockLogOn('2026-06-02'), // week 4, only 1 session
    ];
    const c = computeConsistency(logs, profile, START, asOf);
    expect(c.currentStreakWeeks).toBe(1);
  });
});
