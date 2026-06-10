import type { Program } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProgramPosition {
  /** Week index within the current cycle, clamped to 0..lengthWeeks-1. */
  weekIndex: number;
  /** Full mesocycles elapsed since startDate (0 during the first cycle). */
  cyclesElapsed: number;
  /** Whole days since the program's startDate (never negative). */
  daysSinceStart: number;
}

/**
 * Derives where the climber is in the program from `startDate` + `asOf` (BC-01).
 *
 * Pure: takes `asOf` rather than reading the clock, so the same inputs always
 * yield the same week. `startDate` is parsed as LOCAL midnight (`T00:00:00`) to
 * stay consistent with the local-date keys from `localDateIso` (BC-02).
 *
 * Once a 6-week mesocycle completes the week wraps to 0 and `cyclesElapsed`
 * increments — the caller (bootstrap) rolls the program forward into a fresh
 * cycle so "what do I do today" never dead-ends.
 */
export function programPosition(program: Program, asOf: Date): ProgramPosition {
  const start = new Date(`${program.startDate}T00:00:00`).getTime();
  const daysSinceStart = Math.max(0, Math.floor((asOf.getTime() - start) / DAY_MS));

  const totalWeeks = Math.floor(daysSinceStart / 7);
  const cyclesElapsed = Math.floor(totalWeeks / program.lengthWeeks);
  const weekIndex = totalWeeks % program.lengthWeeks;

  return { weekIndex, cyclesElapsed, daysSinceStart };
}
