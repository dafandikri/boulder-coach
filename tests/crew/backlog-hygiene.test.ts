import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBacklog } from '../../scripts/crew/lib/backlog.mjs';

const md = readFileSync(fileURLToPath(new URL('../../docs/BACKLOG.md', import.meta.url)), 'utf8');

describe('backlog hygiene (real BACKLOG.md)', () => {
  it('every OPEN PBI declares at least one file (Crew lock depends on it)', () => {
    const offenders = parseBacklog(md)
      .filter((p) => p.status === 'open' && p.files.length === 0)
      .map((p) => p.id);
    expect(offenders).toEqual([]);
  });
});
