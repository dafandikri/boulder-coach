import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tryClaim, readClaims } from '../../scripts/crew/lib/claims.mjs';
import { nextAssignable } from '../../scripts/crew/lib/schedule.mjs';

type Pbi = {
  id: string;
  title: string;
  priority: string;
  complexity: string;
  dependsOn: string[];
  files: string[];
  status: 'open' | 'in-progress' | 'done';
};

let repo: string;
const run = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'crew-itest-'));
  run(['init', '-q']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'crew-test']);
  mkdirSync(join(repo, '.crew', 'claims'), { recursive: true });
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('crew integration (tmp git repo)', () => {
  it('a claimed PBI locks its files out of the next assignment', () => {
    const pbis: Pbi[] = [
      {
        id: 'BC-A',
        title: 'a',
        priority: 'P1',
        complexity: 'M',
        dependsOn: [],
        files: ['mock/shared.ts'],
        status: 'open',
      },
      {
        id: 'BC-B',
        title: 'b',
        priority: 'P1',
        complexity: 'M',
        dependsOn: [],
        files: ['mock/shared.ts'],
        status: 'open',
      },
      {
        id: 'BC-C',
        title: 'c',
        priority: 'P1',
        complexity: 'M',
        dependsOn: [],
        files: ['mock/other.ts'],
        status: 'open',
      },
    ];
    const crewRoot = join(repo, '.crew');
    const first = nextAssignable(pbis, [])!;
    expect(first.id).toBe('BC-A');
    expect(
      tryClaim(crewRoot, {
        pbiId: first.id,
        files: first.files,
        worktree: 'mock-wt',
        branch: 'mock-branch',
        status: 'claimed',
        heartbeat: '2026-06-10T10:00:00.000Z',
        owner: 'mock-w1',
      }),
    ).toBe(true);

    const active = readClaims(crewRoot).map((c) => ({ pbiId: c.pbiId, files: c.files }));
    const second = nextAssignable(pbis, active)!;
    expect(second.id).toBe('BC-C'); // BC-B shares mock/shared.ts → locked out
  });
});
