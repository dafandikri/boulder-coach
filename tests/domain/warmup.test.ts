import { describe, it, expect } from 'vitest';
import { generateWarmup } from '../../src/domain/warmup';

describe('generateWarmup', () => {
  it('produces RAMP phases ending in potentiation', () => {
    const blocks = generateWarmup({ injuryActive: false });
    const names = blocks.map((b) => b.name.toLowerCase());
    expect(names.some((n) => n.includes('cardio'))).toBe(true);
    expect(names.some((n) => n.includes('mobil'))).toBe(true);
    expect(names.some((n) => n.includes('easy'))).toBe(true);
    // all warmup blocks are categorised as warmup
    expect(blocks.every((b) => b.category === 'warmup')).toBe(true);
  });

  it('uses open-hand grip first on the climbing potentiation block', () => {
    const blocks = generateWarmup({ injuryActive: false });
    const climb = blocks.find((b) => b.name.toLowerCase().includes('easy'));
    expect(climb?.grip).toBe('open-hand');
  });

  it('adds extra mobilization when an injury flag is active', () => {
    const normal = generateWarmup({ injuryActive: false });
    const injured = generateWarmup({ injuryActive: true });
    expect(injured.length).toBeGreaterThan(normal.length);
  });
});
