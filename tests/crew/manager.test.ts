import { describe, it, expect } from 'vitest';
import { shouldConsultBrain } from '../../scripts/crew/lib/manager.mjs';

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
