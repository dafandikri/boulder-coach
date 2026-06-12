import type { ExerciseContent } from './exerciseContent';

export type SkillCategory = 'technique' | 'prehab';

/** A drill reuses the shared exercise content shape (BC-46): `cues`/`steps`/
 *  `commonMistakes`/`imageId` come from `ExerciseContent`; a drill adds identity +
 *  a one-line `description` for the list view. */
export interface Drill extends ExerciseContent {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
}

export const DRILLS: Drill[] = [
  {
    id: 'drill-footwork-silent',
    name: 'Silent feet',
    category: 'technique',
    description: 'Place each foot precisely with no sound. Repeat until silent.',
    imageId: 'silent-feet',
    steps: [
      'Pick an easy vertical or slab problem you can climb relaxed.',
      'Before each move, look at the foothold and pick the exact spot for your toe.',
      'Place the toe deliberately and set weight through it — aim for zero sound on contact.',
      'If a foot scuffs or slaps, downclimb and repeat that move until it lands silently.',
    ],
    cues: ['Watch your feet land', 'Slow down the placement', 'No scuffing'],
    commonMistakes: [
      'Looking up to the next hand hold before the foot is set',
      'Dragging the toe up the wall instead of placing it',
      'Rushing — silent feet is a slow, deliberate drill',
    ],
  },
  {
    id: 'drill-footwork-deadpoint',
    name: 'Deadpoint practice',
    category: 'technique',
    description: 'Find a lock-off move; practice hitting the hold at the apex of motion.',
    imageId: 'deadpoint',
    steps: [
      'Find a move to a positive hold that feels a touch too far to do statically.',
      'Set your feet and initiate from the legs and hips, not just the arms.',
      'Aim to catch the hold at the “deadpoint” — the weightless apex where you stop rising.',
      'Match the timing so the hand arrives exactly as upward motion stops; repeat both directions.',
    ],
    cues: ['Stretch through the toe', 'One smooth motion', 'Catch and stick'],
    commonMistakes: [
      'Pulling with the arms before driving with the legs',
      'Catching the hold on the way up (too early) or after dropping (too late)',
      'Tensing the whole body so the move becomes a static lunge',
    ],
  },
  {
    id: 'drill-technique-smear',
    name: 'Smear & trust',
    category: 'technique',
    description: 'Climb a slab or vertical section focusing on smearing.',
    imageId: 'smear',
    steps: [
      'Choose a slab or low-angle section with poor or no footholds.',
      'Place as much shoe rubber on the wall as possible and press straight down through it.',
      'Keep your hips in toward the wall so weight stays over the smearing foot.',
      'Trust the friction — stand up on the smear before reaching, rather than snatching higher.',
    ],
    cues: ['Rubber to wall', 'Hips in', 'Weight over the foot'],
    commonMistakes: [
      'Leaning away from the wall, which lifts weight off the smear',
      'Tip-toeing instead of pressing the whole sole down',
      'Reaching before committing weight to the foot',
    ],
  },
  {
    id: 'drill-prehab-ecu',
    name: 'ECU pronation',
    category: 'prehab',
    description: 'Wrist-strengthening for TFCC: pronation with a light band or bottle.',
    imageId: 'ecu-pronation',
    dosage: '2 × 15 each side, slow tempo',
    steps: [
      'Rest your forearm on your thigh, wrist past the knee, holding a light band or a hammer/bottle.',
      'Start palm-down with the weight to one side.',
      'Slowly rotate the forearm to palm-up, then control it back — 3–4 seconds each way.',
      'Stop short of any sharp wrist pain; keep the range pain-free.',
    ],
    cues: ['Slow eccentric', 'Full range of motion', 'No pain'],
    commonMistakes: [
      'Moving the whole arm instead of rotating just the forearm',
      'Going too heavy and losing control of the lowering phase',
      'Pushing into painful range — back off if the TFCC pinches',
    ],
  },
  {
    id: 'drill-prehab-shoulder',
    name: 'Band pull-apart',
    category: 'prehab',
    description: 'Standing band pull-apart for rear delt and scapular control.',
    imageId: 'band-pull-apart',
    dosage: '2 × 15, controlled',
    steps: [
      'Hold a light resistance band in front of you at shoulder height, arms straight.',
      'Pull the band apart by moving your hands outward, leading with the backs of the hands.',
      'Squeeze the shoulder blades together at the end range; keep arms straight throughout.',
      'Return slowly under control to the start — do not let the band snap back.',
    ],
    cues: ['Squeeze shoulder blades', 'Straight arms', 'Slow return'],
    commonMistakes: [
      'Bending the elbows to cheat the movement',
      'Shrugging the shoulders up toward the ears',
      'Letting the band recoil fast instead of controlling the return',
    ],
  },
  {
    id: 'drill-prehab-finger',
    name: 'Tendon glide',
    category: 'prehab',
    description: 'Finger tendon glide sequence: straight hook to full fist to straight.',
    imageId: 'tendon-glide',
    dosage: '2 × 8 cycles per hand',
    steps: [
      'Start with fingers straight and together.',
      'Bend into a “hook” (top two knuckles), then to a full fist, then a straight fist.',
      'Open back through each position to straight fingers — move slowly and fully.',
      'Keep every position pain-free; this is mobility, not a strength effort.',
    ],
    cues: ['Slow and controlled', 'Full extension each rep', 'No pain'],
    commonMistakes: [
      'Rushing through the positions without reaching full range',
      'Squeezing hard into the fist (it should be relaxed, not maximal)',
      'Doing it on cold hands — warm up first',
    ],
  },
];

export function getDrillsByCategory(category: SkillCategory): Drill[] {
  return DRILLS.filter((d) => d.category === category);
}

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
