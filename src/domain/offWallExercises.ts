import type { SessionType, PhaseKind } from './types';
import type { ExerciseContent } from './exerciseContent';

// SAFETY CONTRACT (BC-22): off-wall work is ADDITIVE ONLY. This module is
// supplementary balance/mobility work — it MUST NEVER raise climbing load and
// has no path into adaptation.ts / loadMetrics.ts. It prescribes a short,
// purpose-matched set; it never adds boulder volume, sets, or intensity.
// BC-50 adds detail (dosage/steps/cues/mistakes/image) — still additive-only:
// content is instructional text, with no path into the load engine.

/** Why an off-wall exercise exists, relative to pull-heavy climbing load. */
export type ExercisePurpose = 'antagonist' | 'core' | 'mobility';

/** An off-wall exercise reuses the shared content shape (BC-46) for detail. */
export interface OffWallExercise extends ExerciseContent {
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
    imageId: 'pushup',
    dosage: '3 × 8–12, controlled tempo',
    steps: [
      'Hands a little wider than shoulders, body in one straight line from head to heels.',
      'Brace the core and lower until the chest is just above the floor (2–3 s down).',
      'Press back up without letting the hips sag or pike.',
      'Drop to the knees if form breaks before the rep target.',
    ],
    cues: ['Body in one line', 'Elbows ~45°, not flared', 'Full lockout each rep'],
    commonMistakes: ['Sagging or piking hips', 'Half-range reps', 'Flaring elbows to 90°'],
  },
  {
    id: 'ow-antagonist-dips',
    name: 'Bench dips',
    purpose: 'antagonist',
    description: 'Triceps + anterior shoulder press to offset pull-heavy climbing.',
    imageId: 'bench-dips',
    dosage: '3 × 8–12',
    steps: [
      'Hands on a bench behind you, fingers forward, feet out in front.',
      'Lower by bending the elbows straight back to about 90°.',
      'Keep shoulders down and back — do not shrug up toward the ears.',
      'Press back to a soft lockout; stop short of any shoulder pinch.',
    ],
    cues: ['Shoulders down and back', 'Elbows track straight back', 'Stop above 90° if it pinches'],
    commonMistakes: [
      'Dropping too deep and stressing the shoulder',
      'Shrugging up',
      'Rushing reps',
    ],
  },
  {
    id: 'ow-antagonist-bandpress',
    name: 'Band overhead press',
    purpose: 'antagonist',
    description: 'Light band press for scapular and shoulder push strength.',
    imageId: 'band-overhead-press',
    dosage: '3 × 12',
    steps: [
      'Stand on a light band, hold the ends at shoulder height.',
      'Brace the trunk and press overhead without arching the lower back.',
      'Reach tall at the top, then lower under control.',
    ],
    cues: ['Ribs down, no back arch', 'Press slightly forward of the head', 'Control the lowering'],
    commonMistakes: [
      'Arching the lower back to press',
      'Using a band too heavy to control',
      'Partial range',
    ],
  },
  {
    id: 'ow-core-plank',
    name: 'Front plank',
    purpose: 'core',
    description: 'Brace the trunk; keep hips level. Hold for quality, not time.',
    imageId: 'front-plank',
    dosage: '3 × 30–45 s',
    steps: [
      'Forearms under shoulders, body in one straight line.',
      'Squeeze glutes and brace the abs as if about to be tapped in the stomach.',
      'Hold without letting the hips drop or hike; breathe normally.',
    ],
    cues: ['One straight line', 'Glutes + abs braced', 'Neutral neck'],
    commonMistakes: ['Hips sagging', 'Butt piked up', 'Holding the breath'],
  },
  {
    id: 'ow-core-deadbug',
    name: 'Dead bug',
    purpose: 'core',
    description: 'Anti-extension core control; move opposite limbs slowly.',
    imageId: 'dead-bug',
    dosage: '3 × 8 per side',
    steps: [
      'Lie on your back, arms up, hips and knees at 90°.',
      'Press the lower back gently into the floor and keep it there.',
      'Slowly lower the opposite arm and leg, then return; alternate sides.',
    ],
    cues: ['Lower back stays flat', 'Move slowly', 'Exhale as limbs extend'],
    commonMistakes: ['Lower back arching off the floor', 'Rushing the reps', 'Holding the breath'],
  },
  {
    id: 'ow-core-sideplank',
    name: 'Side plank',
    purpose: 'core',
    description: 'Lateral trunk stability for tension on overhangs.',
    imageId: 'side-plank',
    dosage: '3 × 20–30 s per side',
    steps: [
      'Forearm under the shoulder, body in a straight line on its side.',
      'Lift the hips so only the forearm and bottom foot support you.',
      'Keep the top hip stacked over the bottom; hold steady.',
    ],
    cues: ['Hips stacked', 'Straight line head-to-feet', 'Bottom shoulder packed down'],
    commonMistakes: [
      'Hips dropping toward the floor',
      'Rotating the torso',
      'Shoulder shrugging up',
    ],
  },
  {
    id: 'ow-mobility-shoulder-cars',
    name: 'Shoulder CARs',
    purpose: 'mobility',
    description: 'Controlled articular rotations for the shoulder; slow and full range.',
    imageId: 'shoulder-cars',
    dosage: '3 slow circles each direction, per arm',
    steps: [
      'Stand tall, brace the trunk so only the shoulder moves.',
      'Draw the largest slow circle you can with the arm, reaching through end range.',
      'Reverse the direction; keep the rest of the body still.',
    ],
    cues: ['Move only the shoulder', 'Slow and full', 'No pain through the range'],
    commonMistakes: [
      'Twisting the trunk to cheat range',
      'Rushing the circle',
      'Shrugging the neck',
    ],
  },
  {
    id: 'ow-mobility-hip-90-90',
    name: 'Hip 90/90 rotations',
    purpose: 'mobility',
    description: 'Open hips for high steps and drop-knees; rotate side to side.',
    imageId: 'hip-90-90',
    dosage: '2 × 6 rotations each side',
    steps: [
      'Sit with both knees bent at 90° — one shin in front, one out to the side.',
      'Keeping the chest tall, rotate the knees to the other side under control.',
      'Pause where it feels tight, then continue rotating side to side.',
    ],
    cues: ['Sit tall', 'Drive from the hips', 'Pause at the tight spots'],
    commonMistakes: ['Rounding the back', 'Forcing past a sharp pinch', 'Using momentum'],
  },
  {
    id: 'ow-mobility-tspine',
    name: 'Thoracic openers',
    purpose: 'mobility',
    description: 'Open-book rotations to free the upper back after a climbing session.',
    imageId: 'tspine-openers',
    dosage: '2 × 8 per side',
    steps: [
      'Lie on your side, knees bent, arms stacked out in front.',
      'Open the top arm up and over like a book cover, following the hand with your eyes.',
      'Let the upper back rotate; keep the knees together and down.',
    ],
    cues: ['Follow the hand with your eyes', 'Knees stay down', 'Rotate from the upper back'],
    commonMistakes: [
      'Letting the knees lift and rotate',
      'Forcing the shoulder to the floor',
      'Holding the breath',
    ],
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
