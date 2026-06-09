import type { Block } from './types';

export interface WarmupOptions {
  injuryActive: boolean;
}

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
    },
    {
      id: 'wu-mobilize',
      name: 'Activate & Mobilize: dynamic shoulder/wrist/finger',
      category: 'warmup',
      grip: 'open-hand',
      sets: 1,
      targetRPE: 3,
      notes: 'Arm circles, wrist rotations, finger tendon glides.',
    },
    {
      id: 'wu-potentiate',
      name: 'Potentiate: easy climbing ramp',
      category: 'warmup',
      grip: 'open-hand',
      sets: 10,
      targetRPE: 4,
      notes: '8–12 easy problems, low→high intensity, open-hand first.',
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
    });
  }

  return blocks;
}
