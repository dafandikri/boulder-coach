import { describe, it, expect } from 'vitest';
import {
  sanitizeCountInput,
  normalizeCount,
  SETS_MIN,
  SETS_MAX,
} from '../../src/app/lib/sessionInput';

// BC-60 — the "Sets completed" number field couldn't be cleared and showed a
// leading zero ("08"). Root cause: the field was bound to a `number` (never able
// to hold ""), and `Math.max(0, Number(''))` collapsed "empty" to 0 inline in the
// gate-blind page. The parse/normalize/clamp logic now lives here, fully covered.
//
// Two pure helpers, split by concern:
//   - sanitizeCountInput: what the field DISPLAYS while editing (may be empty;
//     strips non-digits + leading zeros so "08" → "8" and the 0 isn't stuck).
//   - normalizeCount: what we STORE outside the field (empty → 0; clamped to range).

describe('sanitizeCountInput (BC-60 — display while editing)', () => {
  it('keeps an empty field empty so the value can be cleared', () => {
    expect(sanitizeCountInput('')).toBe('');
  });

  it('collapses a lone zero to empty so the stuck "0" can be deleted', () => {
    expect(sanitizeCountInput('0')).toBe('');
  });

  it('strips a leading zero so typing 8 over 0 shows "8", not "08"', () => {
    expect(sanitizeCountInput('08')).toBe('8');
  });

  it('passes a normal single digit through unchanged', () => {
    expect(sanitizeCountInput('8')).toBe('8');
  });

  it('keeps multi-digit values (clamping is a normalize concern, not display)', () => {
    expect(sanitizeCountInput('25')).toBe('25');
  });

  it('drops non-digit characters, including a typed minus sign', () => {
    expect(sanitizeCountInput('-3')).toBe('3');
  });
});

describe('normalizeCount (BC-60 — value stored outside the field)', () => {
  it('normalizes an empty field to 0', () => {
    expect(normalizeCount('')).toBe(0);
  });

  it('normalizes "0" to 0', () => {
    expect(normalizeCount('0')).toBe(0);
  });

  it('parses a leading-zero value as its number', () => {
    expect(normalizeCount('08')).toBe(8);
  });

  it('parses a normal value', () => {
    expect(normalizeCount('8')).toBe(8);
  });

  it('clamps above the max to the max', () => {
    expect(normalizeCount('25')).toBe(SETS_MAX);
  });

  it('clamps a negative value to the min', () => {
    expect(normalizeCount('-3')).toBe(SETS_MIN);
  });

  it('exposes the canonical 0..20 sets range', () => {
    expect(SETS_MIN).toBe(0);
    expect(SETS_MAX).toBe(20);
  });
});
