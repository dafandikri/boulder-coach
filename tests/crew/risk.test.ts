import { describe, it, expect } from 'vitest';
import { classify } from '../../scripts/crew/lib/risk.mjs';

const CONFIG = {
  autoMerge: {
    eligiblePaths: ['src/domain/**', 'src/app/lib/**', 'docs/**'],
    alwaysReview: [
      'src/domain/adaptation.ts',
      'src/domain/loadMetrics.ts',
      'src/app/**/*.tsx',
      'scripts/**',
      'package.json',
    ],
  },
};

describe('classify (mock config)', () => {
  it('auto-merges pure domain changes', () => {
    expect(classify(['src/domain/schedule.ts'], CONFIG)).toBe('auto');
  });
  it('routes safety files to review even though they are under src/domain', () => {
    expect(classify(['src/domain/adaptation.ts'], CONFIG)).toBe('review');
  });
  it('routes any .tsx (gate-blind UI) to review', () => {
    expect(classify(['src/app/program/page.tsx'], CONFIG)).toBe('review');
  });
  it('routes a changeset to review if ANY file is non-eligible', () => {
    expect(classify(['src/domain/schedule.ts', 'src/data/dexieRepo.ts'], CONFIG)).toBe('review');
  });
  it('routes infra changes to review', () => {
    expect(classify(['scripts/crew/conduct.mjs'], CONFIG)).toBe('review');
    expect(classify(['package.json'], CONFIG)).toBe('review');
  });
});
