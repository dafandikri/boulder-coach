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

  // Done PBIs are condensed to one-line `### BC-xx … — `done (…)`` headers in the Shipped
  // log when the backlog grows. They MUST stay parseable headers (not plain bullets): the
  // Crew scheduler gates assignment on `dependsOn.every(d => doneIds.has(d))`
  // (scripts/crew/lib/schedule.mjs), and `doneIds` is built only from PBIs parseBacklog
  // returns as done. A dangling dependency = an open PBI that can never be assigned.
  it('every dependency resolves to a known PBI (archiving must not orphan a dep)', () => {
    const pbis = parseBacklog(md);
    const ids = new Set(pbis.map((p) => p.id));
    const dangling = pbis
      .flatMap((p) => p.dependsOn.map((d) => ({ pbi: p.id, dep: d })))
      .filter(({ dep }) => !ids.has(dep));
    expect(dangling).toEqual([]);
  });

  // A done dependency must actually be parseable AS done — catches the specific regression
  // of collapsing a shipped PBI to a plain bullet (which drops it from `doneIds`), which
  // would silently block every open PBI that depends on it.
  it('every OPEN PBI whose deps exist has those deps resolvable to a status', () => {
    const pbis = parseBacklog(md);
    const byId = new Map(pbis.map((p) => [p.id, p]));
    const unresolved = pbis
      .filter((p) => p.status === 'open')
      .flatMap((p) => p.dependsOn.map((d) => ({ pbi: p.id, dep: d })))
      .filter(({ dep }) => !byId.has(dep));
    expect(unresolved).toEqual([]);
  });

  // PBI ids must be unique. A reused id (e.g. a new open PBI numbered BC-44 when a done
  // BC-44 already exists — the regression that shipped in PR #44, LEARNINGS 2026-06-14)
  // is invisible to the dep checks above: `new Set`/`new Map` silently dedupe, so a
  // `Depends on: BC-44` resolves to *whichever* BC-44 won the map. Allocate the next free
  // number (highest in use + 1), never an id already on the board.
  it('no PBI id is used more than once (open or done)', () => {
    const counts = new Map<string, number>();
    for (const { id } of parseBacklog(md)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const duplicates = [...counts.entries()]
      .filter(([, n]) => n > 1)
      .map(([id, n]) => `${id}×${n}`);
    expect(duplicates).toEqual([]);
  });
});
