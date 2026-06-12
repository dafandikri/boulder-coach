import { describe, it, expect } from 'vitest';
import { frequencyGuidance } from '../../src/domain/frequencyNotes';

// BC-45 — sessions/week can be 1..7. Each frequency gets guidance; high frequencies
// carry an explicit load-management caution ("1x or even 7x, but with notes").

describe('frequencyGuidance', () => {
  it('frames a single weekly session as the one quality day (no caution)', () => {
    const g = frequencyGuidance(1);
    expect(g.caution).toBe(false);
    expect(g.text).toMatch(/quality|one|limit/i);
  });

  it('treats a balanced 2-4 day week as normal (no caution)', () => {
    for (const n of [2, 3, 4]) {
      expect(frequencyGuidance(n).caution).toBe(false);
      expect(frequencyGuidance(n).text.length).toBeGreaterThan(0);
    }
  });

  it('cautions at 5+ days and names recovery (rest / sleep / tweak)', () => {
    for (const n of [5, 6, 7]) {
      const g = frequencyGuidance(n);
      expect(g.caution).toBe(true);
      expect(g.text).toMatch(/rest|sleep|tweak|recover/i);
    }
  });
});
