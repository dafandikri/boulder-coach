import type { Block, BodyPart } from './types';

/**
 * BC-29 — make BASELINE sessions more conservative for body parts the climber has
 * injured before. This is historical risk shaping, distinct from `adaptation.ts`'s
 * same-day reactive rules — which is why it lives here, keeping the safety file (and
 * its invariants fuzzer) focused on today's pain/soreness/load.
 *
 * Additive-safety contract (tested): a prior injury may only make a session EASIER —
 * soften grips and ADD prehab — never raise volume, intensity, or grade. Pure: no I/O.
 */

/** Parts whose prior injury warrants defaulting finger-loading grips to open-hand. */
const SOFTEN_GRIP_PARTS: ReadonlySet<BodyPart> = new Set(['pip', 'wrist-tfcc']);

const PREHAB: Record<BodyPart, { name: string; notes: string }> = {
  pip: {
    name: 'Finger-extensor prehab (prior finger injury)',
    notes: 'Rubber-band finger extensions: 2 × 15, slow and controlled.',
  },
  'wrist-tfcc': {
    name: 'Wrist stability prehab (prior wrist injury)',
    notes: 'Light wrist curls + radial/ulnar deviation: 2 × 12 each.',
  },
  shoulder: {
    name: 'Shoulder prehab (prior shoulder injury)',
    notes: 'Band external rotations + scap pull-aparts: 2 × 12. No overhead loading.',
  },
  elbow: {
    name: 'Elbow prehab (prior elbow injury)',
    notes: 'Reverse wrist curls + pronation/supination: 2 × 15 light.',
  },
};

function prehabBlock(part: BodyPart): Block {
  const { name, notes } = PREHAB[part];
  return {
    id: `injury-prehab-${part}`,
    name,
    category: 'prehab',
    grip: 'open-hand',
    sets: 2,
    targetRPE: 4,
    notes,
  };
}

export function applyInjuryHistory(blocks: Block[], injuryHistory: BodyPart[]): Block[] {
  if (injuryHistory.length === 0) return blocks;

  const flagged = [...new Set(injuryHistory)];
  const softenGrips = flagged.some((p) => SOFTEN_GRIP_PARTS.has(p));

  // Soften finger-loading grips on a prior finger/wrist injury (never the reverse).
  const adjusted = blocks.map((b) => {
    if (softenGrips && (b.grip === 'crimp' || b.grip === 'mixed')) {
      return { ...b, grip: 'open-hand' as const };
    }
    return { ...b };
  });

  // Add one prehab block per distinct flagged part, before the cooldown if present.
  const extra = flagged.map(prehabBlock);
  const cooldownAt = adjusted.findIndex((b) => b.category === 'cooldown');
  if (cooldownAt < 0) return [...adjusted, ...extra];
  return [...adjusted.slice(0, cooldownAt), ...extra, ...adjusted.slice(cooldownAt)];
}
