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
});
