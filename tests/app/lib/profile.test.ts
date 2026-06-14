import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DexieClimbRepo } from '@/data/dexieRepo';
import {
  validateProfile,
  applyProfile,
  DEFAULT_PROFILE,
  type ProfileDraft,
} from '@/app/lib/bootstrap';

// A complete, valid draft used as the baseline for the validation cases. Each
// test mutates one field so the failure is unambiguous. (mock/example data)
const validDraft: ProfileDraft = {
  currentGrade: 4,
  goalGrade: 6,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

describe('validateProfile', () => {
  it('accepts a complete, well-formed draft', () => {
    expect(validateProfile(validDraft)).toBeNull();
  });

  it('accepts a valid injury history (BC-29)', () => {
    expect(validateProfile({ ...validDraft, injuryHistory: ['pip', 'shoulder'] })).toBeNull();
  });

  it('rejects an injury history with an unknown body part (BC-29)', () => {
    // @ts-expect-error — deliberately invalid body part to prove the guard fires
    expect(validateProfile({ ...validDraft, injuryHistory: ['knee'] })).toMatch(/injury/i);
  });

  it('accepts a goal equal to the current grade (maintenance is valid)', () => {
    expect(validateProfile({ ...validDraft, goalGrade: 4, currentGrade: 4 })).toBeNull();
  });

  it('rejects a goal grade below the current grade', () => {
    expect(validateProfile({ ...validDraft, currentGrade: 6, goalGrade: 4 })).toMatch(/goal/i);
  });

  it('accepts the VB and V0 beginner grades (BC-44 floor)', () => {
    expect(validateProfile({ ...validDraft, currentGrade: -1, goalGrade: 6 })).toBeNull(); // VB
    expect(validateProfile({ ...validDraft, currentGrade: 0, goalGrade: 6 })).toBeNull(); // V0
  });

  it('rejects a non-integer or out-of-range current grade', () => {
    expect(validateProfile({ ...validDraft, currentGrade: -2 })).toMatch(/grade/i); // below VB
    expect(validateProfile({ ...validDraft, currentGrade: 2.5 })).toMatch(/grade/i);
    expect(validateProfile({ ...validDraft, currentGrade: 99 })).toMatch(/grade/i);
  });

  it('rejects a non-integer or out-of-range goal grade', () => {
    expect(validateProfile({ ...validDraft, goalGrade: 2.5 })).toMatch(/grade/i);
    expect(validateProfile({ ...validDraft, goalGrade: 99 })).toMatch(/grade/i);
  });

  it('accepts the full 1..7 sessions/week band (BC-45)', () => {
    for (const n of [1, 2, 7]) {
      expect(
        validateProfile({
          ...validDraft,
          sessionsPerWeek: n,
          availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
        }),
      ).toBeNull();
    }
  });

  it('rejects sessions/week outside the supported 1..7 band', () => {
    expect(validateProfile({ ...validDraft, sessionsPerWeek: 0 })).toMatch(/sessions/i);
    expect(validateProfile({ ...validDraft, sessionsPerWeek: 8 })).toMatch(/sessions/i);
  });

  it('rejects an empty weekday selection', () => {
    expect(validateProfile({ ...validDraft, availableWeekdays: [] })).toMatch(/day/i);
  });

  it('rejects fewer training days than sessions/week (the schedule cannot fit)', () => {
    expect(
      validateProfile({ ...validDraft, sessionsPerWeek: 3, availableWeekdays: [1, 3] }),
    ).toMatch(/day/i);
  });

  it('rejects weekday values outside 0..6 or duplicated', () => {
    expect(validateProfile({ ...validDraft, availableWeekdays: [1, 3, 7] })).toMatch(/day/i);
    expect(validateProfile({ ...validDraft, availableWeekdays: [1, 1, 3] })).toMatch(/day/i);
  });
});

describe('applyProfile', () => {
  it('generates the first program on first run regardless of the regenerate flag', async () => {
    const repo = new DexieClimbRepo(`profile-first-${Math.random()}`);
    const result = await applyProfile(repo, validDraft, false, new Date('2026-06-01'));

    expect(result.regenerated).toBe(true);
    expect(await repo.getProfile()).toEqual(validDraft);
    const program = await repo.getActiveProgram();
    expect(program?.weeks[0]?.sessions).toHaveLength(3); // 3×/week rotation
  });

  it('updates the profile without touching the program when regenerate is false', async () => {
    const repo = new DexieClimbRepo(`profile-keep-${Math.random()}`);
    await applyProfile(repo, validDraft, false, new Date('2026-06-01'));
    const before = await repo.getActiveProgram();

    const edited: ProfileDraft = {
      ...validDraft,
      sessionsPerWeek: 4,
      currentGrade: 5,
      goalGrade: 7,
    };
    const result = await applyProfile(repo, edited, false, new Date('2026-06-08'));

    expect(result.regenerated).toBe(false);
    expect(await repo.getProfile()).toEqual(edited); // profile changed
    const after = await repo.getActiveProgram();
    expect(after).toEqual(before); // program untouched (still the old cycle)
    expect(after?.weeks[0]?.sessions).toHaveLength(3);
  });

  it('regenerates the program from the new profile when regenerate is true', async () => {
    const repo = new DexieClimbRepo(`profile-regen-${Math.random()}`);
    await applyProfile(repo, validDraft, false, new Date('2026-06-01'));

    const edited: ProfileDraft = { ...validDraft, sessionsPerWeek: 4 };
    const result = await applyProfile(repo, edited, true, new Date('2026-06-08'));

    expect(result.regenerated).toBe(true);
    const after = await repo.getActiveProgram();
    expect(after?.weeks[0]?.sessions).toHaveLength(4); // rebuilt from 4×/week
    expect(after?.startDate).toBe('2026-06-08'); // fresh cycle anchored to the edit date
  });

  it('DEFAULT_PROFILE remains a valid draft (used as the form seed)', () => {
    expect(validateProfile(DEFAULT_PROFILE)).toBeNull();
  });
});
