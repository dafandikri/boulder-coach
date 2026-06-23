import type { VGrade } from './types';

// BC-44 — the V-scale's beginner floor is VB (V-Basic) then V0; most new climbers
// live at V0–V1. `VGrade` is a bare number so arithmetic (target ± n) keeps working;
// the sub-zero floor is encoded VB = -1, V0 = 0, V1 = 1 … V17. The scale has no
// +/- modifiers, so every grade is a whole number.

/** V-Basic — the easiest gym grade, below V0. Also the scale floor: every grade
 *  floor reads `VB`, never the literal 1, so a beginner is never forced up. */
export const VB: VGrade = -1;
/** V0 — entry of the numbered V-scale. */
export const V0: VGrade = 0;
/** V-scale ceiling. */
export const MAX_GRADE: VGrade = 17;

/** Render a grade for display: VB for the sub-zero floor, otherwise `V{n}`.
 *  The single source of truth for grade text — every `V…` label goes through here
 *  so VB/V0 render correctly and a floored target never shows "V-1". */
export function formatGrade(grade: VGrade): string {
  return grade < V0 ? 'VB' : `V${grade}`;
}

/** A whole grade within the VB…V17 scale. */
export function isValidGrade(grade: number): boolean {
  return Number.isInteger(grade) && grade >= VB && grade <= MAX_GRADE;
}

/** Training audience by ability. BC-44 made VB/V0 onboardable, so the program engine
 *  must coach them differently from the spec's original V4–V6 audience. */
export type GradeBand = 'beginner' | 'intermediate';

/** The highest beginner grade — VB/V0/V1/V2 are beginners; V3+ are intermediate. */
const MAX_BEGINNER_GRADE: VGrade = 2;

/**
 * BC-63: classify a climber so the program can prescribe safely. A true beginner
 * (`currentGrade ≤ MAX_BEGINNER_GRADE`) needs easy mileage + technique and a capped
 * sub-limit stimulus — never the RPE-9 limit / 4×4 power-endurance work that is an
 * A2/PIP injury vector on undeveloped tendons. Pure; the single source of the band rule.
 */
export function gradeBand(currentGrade: VGrade): GradeBand {
  return currentGrade <= MAX_BEGINNER_GRADE ? 'beginner' : 'intermediate';
}
