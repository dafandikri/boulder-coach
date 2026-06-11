import { describe, it, expect } from 'vitest';
import { checkInFormValues, cycleSeverity, DEFAULT_CHECKIN_FORM } from '@/app/lib/checkinForm';
import type { CheckIn } from '@/domain/types';

// An existing check-in for today (mock data) — the prefill must surface THESE
// values, not the blank defaults, so the user edits rather than overwrites.
const existing: CheckIn = {
  date: '2026-06-11',
  sleepQuality: 2,
  overallFatigue: 5,
  motivation: 1,
  soreness: { elbow: 3 },
  pain: { pip: 2 },
};

describe('checkInFormValues', () => {
  it('returns blank defaults (and editing=false) when no check-in exists today', () => {
    const v = checkInFormValues(undefined);
    expect(v.editing).toBe(false);
    expect(v.sleepQuality).toBe(DEFAULT_CHECKIN_FORM.sleepQuality);
    expect(v.overallFatigue).toBe(DEFAULT_CHECKIN_FORM.overallFatigue);
    expect(v.motivation).toBe(DEFAULT_CHECKIN_FORM.motivation);
    expect(v.soreness).toEqual({});
    expect(v.pain).toEqual({});
  });

  it("pre-fills today's existing entry (editing=true) instead of starting blank", () => {
    const v = checkInFormValues(existing);
    expect(v.editing).toBe(true);
    expect(v.sleepQuality).toBe(2);
    expect(v.overallFatigue).toBe(5);
    expect(v.motivation).toBe(1);
    expect(v.soreness).toEqual({ elbow: 3 });
    expect(v.pain).toEqual({ pip: 2 });
  });

  it('copies the soreness/pain maps so later form edits cannot mutate stored state', () => {
    const v = checkInFormValues(existing);
    v.soreness.shoulder = 1;
    expect(existing.soreness).toEqual({ elbow: 3 });
  });
});

describe('cycleSeverity', () => {
  // BC-13: tapping a body-part button cycles none → 1 → 2 → 3 → none. The spec
  // models severity 1..3; the old toggle could only ever record 0 or 2, so the
  // engine could never tell "a bit tender" (1) from "sharp" (3).
  it('starts an absent part at severity 1', () => {
    const mock = {};
    expect(cycleSeverity(mock, 'elbow')).toEqual({ elbow: 1 });
  });

  it('advances 1 → 2', () => {
    const mock = { elbow: 1 };
    expect(cycleSeverity(mock, 'elbow')).toEqual({ elbow: 2 });
  });

  it('advances 2 → 3', () => {
    const mock = { elbow: 2 };
    expect(cycleSeverity(mock, 'elbow')).toEqual({ elbow: 3 });
  });

  it('clears the part after 3 (3 → none)', () => {
    const mock = { elbow: 3 };
    expect(cycleSeverity(mock, 'elbow')).toEqual({});
  });

  it('only touches the tapped part, leaving siblings untouched', () => {
    const mock = { pip: 2, shoulder: 1 };
    expect(cycleSeverity(mock, 'pip')).toEqual({ pip: 3, shoulder: 1 });
  });

  it('does not mutate the input map', () => {
    const mock = { 'wrist-tfcc': 1 };
    const before = { ...mock };
    cycleSeverity(mock, 'wrist-tfcc');
    expect(mock).toEqual(before);
  });
});
