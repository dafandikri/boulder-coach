import { describe, it, expect } from 'vitest';
import { planAssignments } from '../../scripts/crew/lib/split.mjs';

type Pbi = {
  id: string;
  title: string;
  priority: string;
  complexity: string;
  dependsOn: string[];
  files: string[];
  status: 'open' | 'in-progress' | 'done';
};

const pbi = (files: string[]): Pbi => ({
  id: 'BC-X',
  title: 'x',
  priority: 'P1',
  complexity: 'L',
  dependsOn: [],
  files,
  status: 'open',
});

describe('planAssignments (mock)', () => {
  it('returns the whole PBI when there is no split', () => {
    const p = pbi(['a.ts', 'b.ts']);
    expect(planAssignments(p, [], [])).toEqual([{ id: 'BC-X', files: ['a.ts', 'b.ts'] }]);
  });

  it('returns the sub-tasks for a valid, complete, disjoint split', () => {
    const p = pbi(['a.ts', 'b.ts', 'c.ts']);
    const split = [
      { id: 'BC-Xa', files: ['a.ts', 'b.ts'] },
      { id: 'BC-Xb', files: ['c.ts'] },
    ];
    expect(planAssignments(p, split, [])).toEqual(split);
  });

  it('falls back to the whole PBI if sub-tasks overlap each other', () => {
    const p = pbi(['a.ts', 'b.ts']);
    const split = [
      { id: 'BC-Xa', files: ['a.ts'] },
      { id: 'BC-Xb', files: ['a.ts', 'b.ts'] }, // shares a.ts
    ];
    expect(planAssignments(p, split, [])).toEqual([{ id: 'BC-X', files: ['a.ts', 'b.ts'] }]);
  });

  it('falls back if a sub-task references a file outside the PBI lock', () => {
    const p = pbi(['a.ts', 'b.ts']);
    const split = [{ id: 'BC-Xa', files: ['a.ts', 'rogue.ts'] }];
    expect(planAssignments(p, split, [])).toEqual([{ id: 'BC-X', files: ['a.ts', 'b.ts'] }]);
  });

  it('falls back if the split does not cover every PBI file', () => {
    const p = pbi(['a.ts', 'b.ts']);
    const split = [{ id: 'BC-Xa', files: ['a.ts'] }]; // b.ts uncovered
    expect(planAssignments(p, split, [])).toEqual([{ id: 'BC-X', files: ['a.ts', 'b.ts'] }]);
  });

  it('drops units whose files are already locked by an active claim', () => {
    const p = pbi(['a.ts', 'b.ts', 'c.ts']);
    const split = [
      { id: 'BC-Xa', files: ['a.ts', 'b.ts'] },
      { id: 'BC-Xb', files: ['c.ts'] },
    ];
    const active = [{ pbiId: 'OTHER', files: ['b.ts'] }];
    // BC-Xa shares b.ts with an active claim → only BC-Xb is assignable now.
    expect(planAssignments(p, split, active)).toEqual([{ id: 'BC-Xb', files: ['c.ts'] }]);
  });
});
