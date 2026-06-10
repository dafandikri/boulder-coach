import { describe, it, expect } from 'vitest';
import { filesOverlap, nextAssignable } from '../../scripts/crew/lib/schedule.mjs';

type Pbi = {
  id: string;
  title: string;
  priority: string;
  complexity: string;
  dependsOn: string[];
  files: string[];
  status: 'open' | 'in-progress' | 'done';
};

const pbi = (id: string, over: Partial<Pbi>): Pbi => ({
  id,
  title: id,
  priority: 'P1',
  complexity: 'M',
  dependsOn: [],
  files: [],
  status: 'open',
  ...over,
});

describe('filesOverlap (mock)', () => {
  it('detects a shared file', () => {
    expect(filesOverlap(['a.ts', 'b.ts'], ['b.ts'])).toBe(true);
    expect(filesOverlap(['a.ts'], ['b.ts'])).toBe(false);
  });
});

describe('nextAssignable (mock)', () => {
  it('returns a dep-satisfied PBI once its dependency is done', () => {
    const pbis = [
      pbi('BC-2', { dependsOn: ['BC-1'], files: ['x.ts'] }),
      pbi('BC-1', { status: 'done', files: ['y.ts'] }),
    ];
    expect(nextAssignable(pbis, [])?.id).toBe('BC-2');
  });
  it('returns the dep-satisfied, file-disjoint, highest-priority PBI', () => {
    const pbis = [
      pbi('BC-1', { status: 'done', files: ['done.ts'] }),
      pbi('BC-2', { priority: 'P0', dependsOn: ['BC-1'], files: ['a.ts'] }),
      pbi('BC-3', { priority: 'P1', files: ['b.ts'] }),
    ];
    expect(nextAssignable(pbis, [])?.id).toBe('BC-2');
  });
  it('never assigns a PBI whose files overlap an active claim', () => {
    const pbis = [pbi('BC-2', { files: ['a.ts', 'shared.ts'] }), pbi('BC-3', { files: ['c.ts'] })];
    const claims = [{ pbiId: 'BC-9', files: ['shared.ts'] }];
    expect(nextAssignable(pbis, claims)?.id).toBe('BC-3');
  });
  it('excludes already-claimed PBIs and those with no files', () => {
    const pbis = [pbi('BC-2', { files: [] }), pbi('BC-3', { files: ['c.ts'] })];
    expect(nextAssignable(pbis, [{ pbiId: 'BC-3', files: ['c.ts'] }])).toBeNull();
  });
  it('sorts a PBI with a missing/unparsed priority LAST, not ahead of P0', () => {
    const pbis = [
      pbi('BC-2', { priority: '', files: ['a.ts'] }), // malformed: no priority
      pbi('BC-3', { priority: 'P0', files: ['b.ts'] }),
    ];
    expect(nextAssignable(pbis, [])?.id).toBe('BC-3');
  });
});
