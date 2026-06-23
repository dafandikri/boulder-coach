import { describe, it, expect } from 'vitest';
import { MAX_GRADE, VB, V0, formatGrade, gradeBand, isValidGrade } from '../../src/domain/grade';

// BC-44 — the V-scale floor is VB (V-Basic) then V0, where real beginners live.
// VGrade is a bare number, encoded VB = -1, V0 = 0, V1 = 1 … so arithmetic keeps working.

describe('grade scale constants', () => {
  it('floors at VB (-1) and ceils at V17', () => {
    expect(VB).toBe(-1);
    expect(V0).toBe(0);
    expect(MAX_GRADE).toBe(17);
  });
});

describe('formatGrade', () => {
  it('renders VB for the sub-zero beginner grade, not "V-1"', () => {
    expect(formatGrade(VB)).toBe('VB');
  });

  it('renders V0 and the numbered grades', () => {
    expect(formatGrade(V0)).toBe('V0');
    expect(formatGrade(5)).toBe('V5');
    expect(formatGrade(17)).toBe('V17');
  });
});

describe('isValidGrade', () => {
  it('accepts the whole scale from VB to V17', () => {
    expect(isValidGrade(VB)).toBe(true);
    expect(isValidGrade(V0)).toBe(true);
    expect(isValidGrade(1)).toBe(true);
    expect(isValidGrade(MAX_GRADE)).toBe(true);
  });

  it('rejects below VB, above V17, and non-integers', () => {
    expect(isValidGrade(-2)).toBe(false);
    expect(isValidGrade(18)).toBe(false);
    expect(isValidGrade(1.5)).toBe(false);
  });
});

describe('gradeBand (BC-63)', () => {
  it('classifies VB…V2 as beginner', () => {
    expect(gradeBand(VB)).toBe('beginner');
    expect(gradeBand(V0)).toBe('beginner');
    expect(gradeBand(1)).toBe('beginner');
    expect(gradeBand(2)).toBe('beginner');
  });

  it('classifies V3 and up as intermediate', () => {
    expect(gradeBand(3)).toBe('intermediate');
    expect(gradeBand(5)).toBe('intermediate');
    expect(gradeBand(MAX_GRADE)).toBe('intermediate');
  });

  it('puts the band boundary exactly between V2 (beginner) and V3 (intermediate)', () => {
    expect(gradeBand(2)).toBe('beginner');
    expect(gradeBand(3)).toBe('intermediate');
  });
});
