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

// asOf is a Saturday; the current rolling week is the 7 days ending here.
const asOf = new Date(2026, 5, 13); // 2026-06-13 (local)

describe('computeConsistency', () => {
  it('reports zero done and zero streak for a brand-new climber (no logs)', () => {
    const c = computeConsistency([], profile, asOf);
    expect(c.weekDoneCount).toBe(0);
    expect(c.weekTarget).toBe(3);
    expect(c.currentStreakWeeks).toBe(0);
  });

  it('counts sessions logged within the current 7-day window', () => {
    const logs = [mockLogOn('2026-06-08'), mockLogOn('2026-06-10'), mockLogOn('2026-06-12')];
    const c = computeConsistency(logs, profile, asOf);
    expect(c.weekDoneCount).toBe(3);
  });

  it('excludes sessions older than the current window from the done count', () => {
    const logs = [mockLogOn('2026-06-06'), mockLogOn('2026-06-12')]; // 7d+ ago, and in-window
    const c = computeConsistency(logs, profile, asOf);
    expect(c.weekDoneCount).toBe(1);
  });

  it('ignores future-dated logs', () => {
    const c = computeConsistency([mockLogOn('2026-06-20')], profile, asOf);
    expect(c.weekDoneCount).toBe(0);
  });

  it('counts the current week toward the streak once it meets target', () => {
    // current week (ending 06-13) has 3 sessions = target.
    const logs = [mockLogOn('2026-06-08'), mockLogOn('2026-06-10'), mockLogOn('2026-06-12')];
    const c = computeConsistency(logs, profile, asOf);
    expect(c.currentStreakWeeks).toBe(1);
  });

  it('does NOT break the streak when the current week is still in progress', () => {
    // current week has only 1 session so far (below target), but the PRIOR completed
    // week hit target — the streak holds at 1, it doesn't reset to 0.
    const logs = [
      mockLogOn('2026-06-12'), // current week, 1 of 3 so far
      mockLogOn('2026-06-01'), // prior week (7..13 days ago)
      mockLogOn('2026-06-03'),
      mockLogOn('2026-06-05'),
    ];
    const c = computeConsistency(logs, profile, asOf);
    expect(c.weekDoneCount).toBe(1);
    expect(c.currentStreakWeeks).toBe(1); // the completed prior week
  });

  it('extends the streak across consecutive completed weeks meeting target', () => {
    const logs = [
      // current week: 3 sessions (counts)
      mockLogOn('2026-06-08'),
      mockLogOn('2026-06-10'),
      mockLogOn('2026-06-12'),
      // prior week: 3 sessions
      mockLogOn('2026-06-01'),
      mockLogOn('2026-06-03'),
      mockLogOn('2026-06-05'),
      // two weeks ago: only 2 — breaks the streak there
      mockLogOn('2026-05-26'),
      mockLogOn('2026-05-28'),
    ];
    const c = computeConsistency(logs, profile, asOf);
    expect(c.currentStreakWeeks).toBe(2);
  });

  it('breaks the streak at a week that misses target', () => {
    // current week met target, but the prior week missed → streak is just 1.
    const logs = [
      mockLogOn('2026-06-08'),
      mockLogOn('2026-06-10'),
      mockLogOn('2026-06-12'),
      mockLogOn('2026-06-02'), // prior week, only 1 session
    ];
    const c = computeConsistency(logs, profile, asOf);
    expect(c.currentStreakWeeks).toBe(1);
  });
});
