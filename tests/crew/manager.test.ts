import { describe, it, expect } from 'vitest';
import { shouldConsultBrain, consultBrain } from '../../scripts/crew/lib/manager.mjs';

describe('shouldConsultBrain (mock)', () => {
  it('consults the brain for L/XL PBIs (may need splitting)', () => {
    expect(shouldConsultBrain({ complexity: 'L' })).toBe(true);
    expect(shouldConsultBrain({ complexity: 'XL' })).toBe(true);
  });
  it('skips the brain for S/M PBIs (deterministic assignment is enough)', () => {
    expect(shouldConsultBrain({ complexity: 'S' })).toBe(false);
    expect(shouldConsultBrain({ complexity: 'M' })).toBe(false);
  });
});

describe('consultBrain (fail-safe + tool-neutral)', () => {
  const bigPbi = { id: 'BC-91', complexity: 'L', files: ['src/domain/x.ts', 'src/domain/y.ts'] };

  it('falls back to no-split when the configured agent binary is missing', () => {
    expect(consultBrain(bigPbi, ['definitely-not-a-real-binary-xyz123'])).toEqual({ split: [] });
  });
  it('never consults the agent for S/M PBIs', () => {
    expect(consultBrain({ id: 'BC-90', complexity: 'S', files: ['a.ts'] }, ['claude'])).toEqual({
      split: [],
    });
  });
});
