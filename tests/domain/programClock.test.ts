import { describe, it, expect } from 'vitest';
import { generateProgram } from '../../src/domain/periodization';
import { programPosition } from '../../src/domain/programClock';
import type { UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5, // V5 — mock plateau climber
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

const program = generateProgram(profile, '2026-06-01');

describe('programPosition', () => {
  it('is week 0, cycle 0 on the start date', () => {
    const pos = programPosition(program, new Date('2026-06-01T08:00:00'));
    expect(pos.weekIndex).toBe(0);
    expect(pos.cyclesElapsed).toBe(0);
    expect(pos.daysSinceStart).toBe(0);
  });

  it('day 15 after start lands in week index 2, which is a deload week', () => {
    const pos = programPosition(program, new Date('2026-06-16T08:00:00')); // start + 15 days
    expect(pos.weekIndex).toBe(2);
    expect(program.weeks[pos.weekIndex]!.phase).toBe('deload');
  });

  it('rolls into the next cycle once the 6-week mesocycle completes', () => {
    const pos = programPosition(program, new Date('2026-07-13T08:00:00')); // start + 42 days
    expect(pos.weekIndex).toBe(0);
    expect(pos.cyclesElapsed).toBe(1);
  });

  it('clamps to week 0 for a date before the program started', () => {
    const pos = programPosition(program, new Date('2026-05-20T08:00:00'));
    expect(pos.weekIndex).toBe(0);
    expect(pos.cyclesElapsed).toBe(0);
    expect(pos.daysSinceStart).toBe(0);
  });
});
