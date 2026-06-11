import { describe, it, expect } from 'vitest';
import { checkInFormValues, DEFAULT_CHECKIN_FORM } from '@/app/lib/checkinForm';
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
