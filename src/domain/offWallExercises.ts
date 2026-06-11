import type { SessionType, PhaseKind } from './types';

// SAFETY CONTRACT (BC-22): off-wall work is ADDITIVE ONLY. This module is
// supplementary balance/mobility work — it MUST NEVER raise climbing load and
// has no path into adaptation.ts / loadMetrics.ts. It prescribes a short,
// purpose-matched set; it never adds boulder volume, sets, or intensity.

/** Why an off-wall exercise exists, relative to pull-heavy climbing load. */
export type ExercisePurpose = 'antagonist' | 'core' | 'mobility';

export interface OffWallExercise {
  id: string;
  name: string;
  purpose: ExercisePurpose;
  description: string;
}

/** The day's off-wall prescription: which purposes, and the matched exercises. */
export interface OffWallPrescription {
  purposes: ExercisePurpose[];
  exercises: OffWallExercise[];
}

/**
 * Small hardcoded library (YAGNI: a handful per purpose). `antagonist` work
 * balances the pull-dominant load climbing imposes; `core` stabilises;
 * `mobility` keeps shoulders/hips supple for recovery.
 */
export const OFF_WALL_EXERCISES: OffWallExercise[] = [
  {
    id: 'ow-antagonist-pushup',
    name: 'Push-ups',
    purpose: 'antagonist',
    description: 'Press to balance pulling load. Controlled tempo, full range.',
  },
  {
    id: 'ow-antagonist-dips',
    name: 'Bench dips',
    purpose: 'antagonist',
    description: 'Triceps + anterior shoulder press to offset pull-heavy climbing.',
  },
  {
    id: 'ow-antagonist-bandpress',
    name: 'Band overhead press',
    purpose: 'antagonist',
    description: 'Light band press for scapular and shoulder push strength.',
  },
  {
    id: 'ow-core-plank',
    name: 'Front plank',
    purpose: 'core',
    description: 'Brace the trunk; keep hips level. Hold for quality, not time.',
  },
  {
    id: 'ow-core-deadbug',
    name: 'Dead bug',
    purpose: 'core',
    description: 'Anti-extension core control; move opposite limbs slowly.',
  },
  {
    id: 'ow-core-sideplank',
    name: 'Side plank',
    purpose: 'core',
    description: 'Lateral trunk stability for tension on overhangs.',
  },
  {
    id: 'ow-mobility-shoulder-cars',
    name: 'Shoulder CARs',
    purpose: 'mobility',
    description: 'Controlled articular rotations for the shoulder; slow and full range.',
  },
  {
    id: 'ow-mobility-hip-90-90',
    name: 'Hip 90/90 rotations',
    purpose: 'mobility',
    description: 'Open hips for high steps and drop-knees; rotate side to side.',
  },
  {
    id: 'ow-mobility-tspine',
    name: 'Thoracic openers',
    purpose: 'mobility',
    description: 'Open-book rotations to free the upper back after a climbing session.',
  },
];

export function getExercisesByPurpose(purpose: ExercisePurpose): OffWallExercise[] {
  return OFF_WALL_EXERCISES.filter((e) => e.purpose === purpose);
}

/**
 * Map the day's session type to the off-wall purposes that best balance it.
 * Hard pulling days (limit / power-endurance) pair antagonist push + core;
 * lighter volume/technique days favour core + mobility; an antagonist-prehab
 * day already presses, so it pairs antagonist + mobility; rest days are
 * mobility-only (recovery). Pure switch — no defaults, every SessionType has a
 * branch so an added type is a compile error, not a silent fallthrough.
 */
function purposesForSession(type: SessionType): ExercisePurpose[] {
  switch (type) {
    case 'limit-boulder':
    case 'power-endurance':
      return ['antagonist', 'core'];
    case 'volume-technique':
      return ['core', 'mobility'];
    case 'antagonist-prehab':
      return ['antagonist', 'mobility'];
    case 'rest':
      return ['mobility'];
  }
}

/**
 * Deterministic, pure picker. Returns the exercises for every prescribed
 * purpose — a short, additive supplement. A `deload` week overrides to
 * mobility-only regardless of session type, matching the recovery emphasis of a
 * deload (and never adding load). No date logic, so no `asOf` is needed; if any
 * were added it would be passed in, never read from the clock (domain purity).
 *
 * Picks the first exercise per purpose. The library guarantees ≥1 exercise per
 * purpose (asserted by the gate), so `getExercisesByPurpose` is filtered with
 * `flatMap(slice(0, 1))` — no unreachable `undefined` guard to leave a dead,
 * uncovered branch behind (see skills/universal-quality-bar.md §1).
 */
export function prescribeOffWall(type: SessionType, phase?: PhaseKind): OffWallPrescription {
  const purposes: ExercisePurpose[] = phase === 'deload' ? ['mobility'] : purposesForSession(type);
  const exercises = purposes.flatMap((p) => getExercisesByPurpose(p).slice(0, 1));
  return { purposes, exercises };
}
