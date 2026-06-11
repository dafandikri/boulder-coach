import { describe, it, expect } from 'vitest';
import {
  detectLayoff,
  generateProgram,
  LAYOFF_GAP_DAYS,
  PHASE_PATTERN,
  reEntryReRamp,
} from '../../src/domain/periodization';
import type { PlannedSession, SessionLog, UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5,
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

/** A minimal logged session on `date` — only fields the layoff rule reads matter. */
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

describe('generateProgram', () => {
  it('builds a 6-week waved mesocycle', () => {
    const p = generateProgram(profile, '2026-06-09');
    expect(p.lengthWeeks).toBe(6);
    expect(p.weeks).toHaveLength(6);
    expect(p.weeks.map((w) => w.phase)).toEqual(PHASE_PATTERN);
  });

  it('schedules sessionsPerWeek sessions in each week', () => {
    const p = generateProgram(profile, '2026-06-09');
    for (const w of p.weeks) {
      expect(w.sessions).toHaveLength(3);
    }
  });

  it('includes a non-empty warm-up plus main work in each session', () => {
    const p = generateProgram(profile, '2026-06-09');
    const s = p.weeks[0]!.sessions[0]!;
    expect(s.blocks.some((b) => b.category === 'warmup')).toBe(true);
    expect(s.blocks.some((b) => b.category === 'main')).toBe(true);
  });

  it('targets at or above current grade on limit days in hard weeks', () => {
    const p = generateProgram(profile, '2026-06-09');
    const limit = p.weeks[0]!.sessions.find((s) => s.type === 'limit-boulder');
    const mainBlock = limit?.blocks.find((b) => b.category === 'main');
    expect(mainBlock?.targetGrade).toBeGreaterThanOrEqual(profile.currentGrade);
  });

  it('uses a 2-session rotation when sessionsPerWeek is 2', () => {
    const p = generateProgram({ ...profile, sessionsPerWeek: 2 }, '2026-06-09');
    expect(p.weeks[0]!.sessions).toHaveLength(2);
    expect(p.weeks[0]!.sessions.map((s) => s.type)).toEqual(['limit-boulder', 'power-endurance']);
  });

  it('adds an antagonist-prehab day when sessionsPerWeek is 4', () => {
    const p = generateProgram({ ...profile, sessionsPerWeek: 4 }, '2026-06-09');
    expect(p.weeks[0]!.sessions).toHaveLength(4);
    const types = p.weeks[0]!.sessions.map((s) => s.type);
    expect(types).toContain('antagonist-prehab');
    const antagonist = p.weeks[0]!.sessions.find((s) => s.type === 'antagonist-prehab');
    expect(antagonist!.blocks.some((b) => b.category === 'main')).toBe(true);
  });

  it('reduces main volume in deload weeks vs hard weeks', () => {
    const p = generateProgram(profile, '2026-06-09');
    const hardMain = p.weeks[0]!.sessions[0]!.blocks.filter((b) => b.category === 'main').reduce(
      (s, b) => s + b.sets,
      0,
    );
    const deloadMain = p.weeks[2]!.sessions[0]!.blocks.filter((b) => b.category === 'main').reduce(
      (s, b) => s + b.sets,
      0,
    );
    expect(deloadMain).toBeLessThan(hardMain);
  });
});

const asOf = new Date('2026-06-11');

describe('detectLayoff', () => {
  it('reports no layoff and a null gap when there are no logs (new climber)', () => {
    const status = detectLayoff([], asOf);
    expect(status.daysSinceLastLog).toBeNull();
    expect(status.isLongLayoff).toBe(false);
  });

  it('measures the gap from the MOST RECENT log, not the oldest', () => {
    const logs = [mockLogOn('2026-05-12'), mockLogOn('2026-06-06')]; // 30d and 5d ago
    const status = detectLayoff(logs, asOf);
    expect(status.daysSinceLastLog).toBe(5);
    expect(status.isLongLayoff).toBe(false);
  });

  it('does NOT flag a layoff one day below the threshold', () => {
    const status = detectLayoff([mockLogOn('2026-05-29')], asOf); // 13 days
    expect(status.daysSinceLastLog).toBe(LAYOFF_GAP_DAYS - 1);
    expect(status.isLongLayoff).toBe(false);
  });

  it('flags a layoff exactly at the threshold boundary', () => {
    const status = detectLayoff([mockLogOn('2026-05-28')], asOf); // 14 days
    expect(status.daysSinceLastLog).toBe(LAYOFF_GAP_DAYS);
    expect(status.isLongLayoff).toBe(true);
  });

  it('ignores future-dated logs when finding the most recent one', () => {
    const status = detectLayoff([mockLogOn('2026-07-01')], asOf); // after asOf
    expect(status.daysSinceLastLog).toBeNull();
    expect(status.isLongLayoff).toBe(false);
  });
});

describe('reEntryReRamp', () => {
  function limitSession(): PlannedSession {
    const p = generateProgram(profile, '2026-06-09');
    const s = p.weeks[0]!.sessions.find((x) => x.type === 'limit-boulder');
    return s!;
  }

  function mainSets(s: PlannedSession): number {
    return s.blocks.filter((b) => b.category === 'main').reduce((sum, b) => sum + b.sets, 0);
  }

  it('returns null when the climber logged recently (no layoff)', () => {
    const result = reEntryReRamp(limitSession(), [mockLogOn('2026-06-08')], asOf);
    expect(result).toBeNull();
  });

  it('returns null for a brand-new climber with no logs', () => {
    const result = reEntryReRamp(limitSession(), [], asOf);
    expect(result).toBeNull();
  });

  it('halves main volume and caps intensity after a long layoff', () => {
    const planned = limitSession();
    const before = mainSets(planned);
    const result = reEntryReRamp(planned, [mockLogOn('2026-05-21')], asOf); // 21 days
    expect(result).not.toBeNull();
    expect(mainSets(result!.adjustedSession)).toBeLessThan(before);
    for (const b of result!.adjustedSession.blocks) {
      if (b.category === 'main') expect(b.targetRPE).toBeLessThanOrEqual(6);
    }
  });

  it('makes the warm-up mandatory and surfaces a clear re-ramp reason', () => {
    const result = reEntryReRamp(limitSession(), [mockLogOn('2026-05-21')], asOf); // 3 weeks
    expect(result!.warmupMandatory).toBe(true);
    expect(result!.changes).toHaveLength(1);
    expect(result!.changes[0]!.ruleId).toBe('layoff-reramp');
    expect(result!.changes[0]!.reason).toContain('3');
  });

  it('does not mutate the planned session passed in (purity)', () => {
    const planned = limitSession();
    const before = mainSets(planned);
    reEntryReRamp(planned, [mockLogOn('2026-05-21')], asOf);
    expect(mainSets(planned)).toBe(before);
  });
});
