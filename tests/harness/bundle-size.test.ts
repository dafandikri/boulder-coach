import { describe, it, expect } from 'vitest';
import { summarizeBundle } from '../../scripts/check-bundle-size.mjs';

describe('summarizeBundle (BC-36 budget logic)', () => {
  const sizeOf = (f: string) => ({ 'a.js': 100_000, 'b.js': 50_000 })[f] ?? 0;

  it('sums the gzipped sizes of the first-load files', () => {
    const r = summarizeBundle({ files: ['a.js', 'b.js'], sizeOf, limitBytes: 200_000 });
    expect(r.totalBytes).toBe(150_000);
    expect(r.items).toHaveLength(2);
  });

  it('is within budget when total <= limit (inclusive boundary)', () => {
    const r = summarizeBundle({ files: ['a.js', 'b.js'], sizeOf, limitBytes: 150_000 });
    expect(r.withinBudget).toBe(true);
  });

  it('fails the budget when total exceeds the limit', () => {
    const r = summarizeBundle({ files: ['a.js', 'b.js'], sizeOf, limitBytes: 149_999 });
    expect(r.withinBudget).toBe(false);
  });
});
