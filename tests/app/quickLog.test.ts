import { describe, it, expect } from 'vitest';
import {
  validateQuickLog,
  freeformLogId,
  buildQuickLogInput,
  gradeBand,
  type QuickLogForm,
} from '../../src/app/lib/quickLog';
import { createSessionLog } from '../../src/domain/sessionLog';
import { VB, MAX_GRADE, isValidGrade } from '../../src/domain/grade';
import { computeLoadMetrics } from '../../src/domain/loadMetrics';
import { computeConsistency } from '../../src/domain/consistency';
import type { UserProfile } from '../../src/domain/types';

// BC-64 — freeform / quick logging of off-plan sessions. The decision logic (validate,
// id-disambiguation, building the write input) is pure + covered here; the page only
// does the repo I/O. A freeform log has no plannedSessionId and must flow through the
// same engine (loadMetrics/consistency/insights) with no engine change.

function form(over: Partial<QuickLogForm> = {}): QuickLogForm {
  return {
    date: '2026-06-20',
    durationMin: 60,
    sessionRPE: 7,
    gradesSent: [],
    ...over,
  };
}

describe('validateQuickLog (BC-64)', () => {
  it('accepts a well-formed freeform log', () => {
    expect(validateQuickLog(form())).toBeNull();
  });

  it('rejects a missing or malformed date', () => {
    expect(validateQuickLog(form({ date: '' }))).toMatch(/date/i);
    expect(validateQuickLog(form({ date: '20-6-2026' }))).toMatch(/date/i);
  });

  it('rejects a non-positive or non-finite duration', () => {
    expect(validateQuickLog(form({ durationMin: 0 }))).toMatch(/duration/i);
    expect(validateQuickLog(form({ durationMin: -5 }))).toMatch(/duration/i);
    expect(validateQuickLog(form({ durationMin: Number.NaN }))).toMatch(/duration/i);
  });

  it('rejects an out-of-range or non-integer session RPE', () => {
    expect(validateQuickLog(form({ sessionRPE: 0 }))).toMatch(/rpe/i);
    expect(validateQuickLog(form({ sessionRPE: 11 }))).toMatch(/rpe/i);
    expect(validateQuickLog(form({ sessionRPE: 7.5 }))).toMatch(/rpe/i);
  });
});

describe('gradeBand (BC-64 — sends picker range)', () => {
  it('centres a 7-grade band on the current grade', () => {
    expect(gradeBand(5)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('floors the band at VB for a beginner (never below the scale)', () => {
    const band = gradeBand(VB);
    expect(band[0]).toBe(VB);
    expect(band.every((g) => isValidGrade(g))).toBe(true);
  });

  it('clamps the band at MAX_GRADE for a strong climber (never above the scale)', () => {
    const band = gradeBand(MAX_GRADE);
    expect(band[band.length - 1]).toBe(MAX_GRADE);
    expect(band.every((g) => isValidGrade(g))).toBe(true);
    expect(Math.max(...band)).toBeLessThanOrEqual(MAX_GRADE);
  });
});

describe('freeformLogId (BC-64)', () => {
  it('never reuses the planned-session id log-<date>, so it cannot overwrite it', () => {
    const id = freeformLogId('2026-06-20', ['log-2026-06-20']);
    expect(id).toBe('log-2026-06-20-q1');
    expect(id).not.toBe('log-2026-06-20');
  });

  it('increments past existing freeform ids on the same day', () => {
    const existing = ['log-2026-06-20', 'log-2026-06-20-q1', 'log-2026-06-20-q2'];
    expect(freeformLogId('2026-06-20', existing)).toBe('log-2026-06-20-q3');
  });

  it('starts at q1 on a day with no logs yet', () => {
    expect(freeformLogId('2026-06-20', [])).toBe('log-2026-06-20-q1');
  });
});

describe('buildQuickLogInput (BC-64)', () => {
  it('builds a planned-session-less input with a unique id that round-trips to a valid log', () => {
    const input = buildQuickLogInput(form({ gradesSent: [5, 5, 6], notes: 'mock drop-in' }), [
      'log-2026-06-20',
    ]);
    expect(input.plannedSessionId).toBeUndefined();
    expect(input.id).toBe('log-2026-06-20-q1');

    const log = createSessionLog(input);
    expect(log.id).toBe('log-2026-06-20-q1');
    expect(log.date).toBe('2026-06-20');
    expect(log.sessionRPE).toBe(7);
    expect(log.durationMin).toBe(60);
    expect(log.notes).toBe('mock drop-in');
    // sends are also attempts (every send is an attempt) — satisfies the BC-65 invariant
    expect(log.blocks[0]!.gradesSent).toEqual([5, 5, 6]);
    expect(log.blocks[0]!.gradesAttempted).toEqual([5, 5, 6]);
  });

  it('carries load even with no grades logged (RPE × duration drives ACWR)', () => {
    const log = createSessionLog(buildQuickLogInput(form({ gradesSent: [] }), []));
    expect(log.blocks[0]!.gradesSent).toEqual([]);
    expect(log.sessionRPE).toBe(7);
    expect(log.durationMin).toBe(60);
  });

  it('a freeform log feeds the engines with NO engine change (ACWR + consistency)', () => {
    // asOf is a couple of days after the logged session so it's unambiguously
    // in-window regardless of how each engine parses the date (UTC vs local).
    const asOf = new Date('2026-06-20T12:00:00');
    const profile: UserProfile = {
      currentGrade: 5,
      goalGrade: 7,
      sessionsPerWeek: 3,
      availableWeekdays: [1, 3, 5],
    };
    const freeform = createSessionLog(
      buildQuickLogInput(form({ date: '2026-06-18', sessionRPE: 8, durationMin: 90 }), []),
    );
    // ACWR: the off-plan session now contributes acute load (was invisible before).
    expect(computeLoadMetrics([freeform], asOf).acute).toBeGreaterThan(0);
    // Consistency: it counts toward this program week's session total.
    expect(
      computeConsistency([freeform], profile, '2026-06-01', asOf).weekDoneCount,
    ).toBeGreaterThan(0);
  });
});
