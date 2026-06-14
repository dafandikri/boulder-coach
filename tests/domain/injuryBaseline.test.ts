import { describe, it, expect } from 'vitest';
import { applyInjuryHistory } from '../../src/domain/injuryBaseline';
import type { Block, BodyPart } from '../../src/domain/types';

function baseBlocks(): Block[] {
  return [
    { id: 'wu', name: 'Warm-up', category: 'warmup', grip: 'open-hand', sets: 10, targetRPE: 4 },
    {
      id: 'm',
      name: 'Limit bouldering',
      category: 'main',
      grip: 'crimp',
      sets: 6,
      targetGrade: 5,
      targetRPE: 9,
    },
    { id: 'cd', name: 'Cooldown', category: 'cooldown', grip: 'open-hand', sets: 2, targetRPE: 4 },
  ];
}

const mainOf = (bs: Block[]) => bs.filter((b) => b.category === 'main');
const totalMainSets = (bs: Block[]) => mainOf(bs).reduce((n, b) => n + b.sets, 0);

describe('applyInjuryHistory (BC-29)', () => {
  it('leaves the session unchanged when there is no injury history', () => {
    const blocks = baseBlocks();
    expect(applyInjuryHistory(blocks, [])).toEqual(blocks);
  });

  it('does not mutate the input blocks (pure)', () => {
    const blocks = baseBlocks();
    const snapshot = structuredClone(blocks);
    applyInjuryHistory(blocks, ['pip']);
    expect(blocks).toEqual(snapshot);
  });

  it('a prior finger (PIP) injury defaults crimp/mixed grips to open-hand', () => {
    const out = applyInjuryHistory(baseBlocks(), ['pip']);
    for (const b of out) expect(b.grip).toBe('open-hand');
  });

  it('adds exactly one prehab block per distinct flagged part', () => {
    const out = applyInjuryHistory(baseBlocks(), ['pip', 'shoulder', 'pip']);
    const prehab = out.filter((b) => b.category === 'prehab');
    expect(prehab).toHaveLength(2); // pip + shoulder, deduped
    expect(prehab.some((b) => b.id === 'injury-prehab-pip')).toBe(true);
    expect(prehab.some((b) => b.id === 'injury-prehab-shoulder')).toBe(true);
  });

  it('a prior shoulder injury adds shoulder prehab but keeps finger grips as-is', () => {
    const out = applyInjuryHistory(baseBlocks(), ['shoulder']);
    expect(out.some((b) => b.id === 'injury-prehab-shoulder')).toBe(true);
    // shoulder history does not touch finger grips
    expect(mainOf(out)[0]?.grip).toBe('crimp');
  });

  it('appends prehab at the end when the session has no cooldown block', () => {
    const noCooldown: Block[] = [
      { id: 'm', name: 'Main', category: 'main', grip: 'open-hand', sets: 6, targetRPE: 8 },
    ];
    const out = applyInjuryHistory(noCooldown, ['elbow']);
    expect(out[out.length - 1]?.id).toBe('injury-prehab-elbow');
  });

  it('is additive-safety: never raises load/intensity/grade vs no history', () => {
    const all: BodyPart[] = ['pip', 'wrist-tfcc', 'shoulder', 'elbow'];
    const baseline = baseBlocks();
    const out = applyInjuryHistory(baseline, all);

    // total MAIN climbing volume never increases
    expect(totalMainSets(out)).toBeLessThanOrEqual(totalMainSets(baseline));
    // grades are never bumped; intensity never raised; grips never made harder
    for (const b of mainOf(out)) {
      const orig = mainOf(baseline).find((o) => o.id === b.id);
      expect(b.targetGrade).toBe(orig?.targetGrade);
      expect(b.targetRPE).toBeLessThanOrEqual(orig?.targetRPE ?? Infinity);
      expect(b.grip).not.toBe('crimp');
      expect(b.grip).not.toBe('mixed');
    }
  });
});
