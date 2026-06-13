import type { Block } from './types';
import type { ExerciseContent } from './exerciseContent';

export interface WarmupOptions {
  injuryActive: boolean;
}

/** BC-52: every warm-up block carries the same rich `ExerciseContent` (steps/cues/
 *  mistakes/image) the main blocks do, so the session player's "How to do this"
 *  explains the *mandatory* warm-up instead of dropping to a bare label. The how-to
 *  agrees with each block's one-line `notes` summary (RAISE → ACTIVATE → POTENTIATE). */
const WARMUP_CONTENT: Record<string, ExerciseContent> = {
  'wu-raise': {
    imageId: 'warmup-raise',
    steps: [
      'Pick light cardio: jog, row, skip, or cycle.',
      'Go for 5–10 minutes at an easy, conversational pace.',
      'Aim to break a light sweat and feel your heart rate lift — no more.',
    ],
    cues: ['Easy pace', 'Light sweat, not breathless', 'General before specific'],
    commonMistakes: [
      'Skipping the raise and going straight to the wall cold',
      'Going so hard you fatigue before you climb',
    ],
  },
  'wu-mobilize': {
    imageId: 'warmup-mobilize',
    steps: [
      'Arm circles forward and back to open the shoulders.',
      'Wrist circles and gentle wrist flexor/extensor stretches.',
      'Finger tendon glides: fist → hook → straight, slow and controlled.',
      'A few scapular pull-ups / shrugs to wake the pulling chain.',
    ],
    cues: ['Full range, no force', 'Controlled and slow', 'Joints before tendons'],
    commonMistakes: [
      'Bouncing or forcing end-range stretches',
      'Rushing the finger glides — the tendons need slow reps',
    ],
  },
  'wu-potentiate': {
    imageId: 'warmup-potentiate',
    steps: [
      'Start on easy problems well below your limit, open-hand grips first.',
      'Climb 8–12 problems, stepping the difficulty up gradually.',
      'By the last few you should feel primed but nowhere near failure.',
      'Save crimps and tweaky holds for the very end of the ramp.',
    ],
    cues: ['Low → high intensity', 'Open-hand first', 'Primed, not pumped'],
    commonMistakes: [
      'Jumping onto hard or crimpy problems too early',
      'Pumping out so the main work suffers',
    ],
  },
  'wu-extra-mobilize': {
    imageId: 'warmup-mobilize',
    steps: [
      'Spend extra time on the flagged joint before any loading.',
      'Gentle joint-specific mobility through pain-free range only.',
      'Add a light activation set for the area (band work) before climbing.',
    ],
    cues: ['Pain-free range only', 'Extra time today', 'Activate before you load'],
    commonMistakes: [
      'Loading the flagged area before it is warm',
      'Pushing into any sharp or pinching range',
    ],
  },
};

export function generateWarmup({ injuryActive }: WarmupOptions): Block[] {
  const blocks: Block[] = [
    {
      id: 'wu-raise',
      name: 'Raise: light cardio',
      category: 'warmup',
      grip: 'open-hand',
      sets: 1,
      targetRPE: 3,
      notes: '5–10 min jog / row / skip to raise heart rate.',
      content: WARMUP_CONTENT['wu-raise'],
    },
    {
      id: 'wu-mobilize',
      name: 'Activate & Mobilize: dynamic shoulder/wrist/finger',
      category: 'warmup',
      grip: 'open-hand',
      sets: 1,
      targetRPE: 3,
      notes: 'Arm circles, wrist rotations, finger tendon glides.',
      content: WARMUP_CONTENT['wu-mobilize'],
    },
    {
      id: 'wu-potentiate',
      name: 'Potentiate: easy climbing ramp',
      category: 'warmup',
      grip: 'open-hand',
      sets: 10,
      targetRPE: 4,
      notes: '8–12 easy problems, low→high intensity, open-hand first.',
      content: WARMUP_CONTENT['wu-potentiate'],
    },
  ];

  if (injuryActive) {
    blocks.splice(2, 0, {
      id: 'wu-extra-mobilize',
      name: 'Extra mobilization (injury flag active)',
      category: 'warmup',
      grip: 'open-hand',
      sets: 1,
      targetRPE: 2,
      notes: 'Extended joint-specific mobility before any loading.',
      content: WARMUP_CONTENT['wu-extra-mobilize'],
    });
  }

  return blocks;
}
