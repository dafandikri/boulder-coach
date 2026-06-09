import { describe, it, expect } from 'vitest';
import { DRILLS, getDrillsByCategory, getDrill } from '../../src/domain/drills';

describe('drills library', () => {
  it('has seeded drills', () => {
    expect(DRILLS.length).toBeGreaterThan(0);
  });

  it('each drill has required fields', () => {
    for (const d of DRILLS) {
      expect(d.id).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.category).toMatch(/^(technique|prehab)$/);
      expect(d.description).toBeTruthy();
      expect(Array.isArray(d.cues)).toBe(true);
    }
  });

  it('filters by category', () => {
    const tech = getDrillsByCategory('technique');
    expect(tech.every((d) => d.category === 'technique')).toBe(true);
    expect(tech.length).toBeGreaterThan(0);
  });

  it('finds a drill by id', () => {
    const d = getDrill('drill-prehab-finger');
    expect(d).toBeDefined();
    expect(d!.name).toBe('Tendon glide');
  });

  it('returns undefined for unknown id', () => {
    expect(getDrill('nonexistent')).toBeUndefined();
  });
});
