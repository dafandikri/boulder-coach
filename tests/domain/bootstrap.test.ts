import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DexieClimbRepo } from '../../src/data/dexieRepo';
import { getTodaySession, DEFAULT_PROFILE } from '../../src/app/lib/bootstrap';

describe('getTodaySession', () => {
  it('creates a profile + program on first run and returns an adapted session', async () => {
    const repo = new DexieClimbRepo(`boot-${Math.random()}`);
    const result = await getTodaySession(repo, new Date('2026-06-09'));

    expect(await repo.getProfile()).toEqual(DEFAULT_PROFILE);
    expect(await repo.getActiveProgram()).toBeDefined();
    expect(result.session.blocks.length).toBeGreaterThan(0);
    expect(Array.isArray(result.changes)).toBe(true);
  });

  it('reuses the existing program on subsequent runs', async () => {
    const repo = new DexieClimbRepo(`boot-${Math.random()}`);
    await getTodaySession(repo, new Date('2026-06-09'));
    const firstProgram = await repo.getActiveProgram();
    await getTodaySession(repo, new Date('2026-06-10'));
    const secondProgram = await repo.getActiveProgram();
    expect(secondProgram?.id).toBe(firstProgram?.id);
  });

  it('advances to the derived week as time passes (BC-01)', async () => {
    const repo = new DexieClimbRepo(`boot-week-${Math.random()}`);
    await getTodaySession(repo, new Date('2026-06-01T08:00:00')); // program starts day 0
    const later = await getTodaySession(repo, new Date('2026-06-16T08:00:00')); // start + 15 days
    expect(later.session.weekIndex).toBe(2); // week index 2 — a deload week
  });

  it('rolls into a fresh cycle once the 6-week mesocycle completes (BC-01)', async () => {
    const repo = new DexieClimbRepo(`boot-roll-${Math.random()}`);
    await getTodaySession(repo, new Date('2026-06-01T08:00:00'));
    const firstProgram = await repo.getActiveProgram();
    const rolled = await getTodaySession(repo, new Date('2026-07-13T08:00:00')); // start + 42 days
    const secondProgram = await repo.getActiveProgram();
    expect(secondProgram?.id).not.toBe(firstProgram?.id); // new mesocycle persisted
    expect(rolled.session.weekIndex).toBe(0); // back to week 0 of the new cycle
  });

  it('drives a full week: training on availableWeekdays, rest otherwise (BC-03)', async () => {
    const repo = new DexieClimbRepo(`boot-rest-${Math.random()}`);
    // Default profile trains Mon/Wed/Fri; program starts Mon 2026-06-01.
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 5, 1 + i, 8); // 08:00 local, Mon..Sun of week 0
      const r = await getTodaySession(repo, d);
      if ([1, 3, 5].includes(d.getDay())) {
        expect(r.session.type).not.toBe('rest');
      } else {
        expect(r.session.type).toBe('rest');
        expect(r.changes).toHaveLength(0); // rest day carries no adaptation noise
      }
    }
  });
});
