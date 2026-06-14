import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { getRepo } from '../../src/data/repoInstance';
import { DexieClimbRepo } from '../../src/data/dexieRepo';

// BC-21 — one shared repository instance. Every page used to `new DexieClimbRepo()`
// per render/effect, opening a fresh Dexie connection each time. A lazy singleton
// gives one connection and one seam to swap when a sync repo (BC-18) lands.

describe('getRepo (BC-21)', () => {
  it('returns the same instance on repeated calls (one shared connection)', () => {
    expect(getRepo()).toBe(getRepo());
  });

  it('is the DexieClimbRepo implementation of the IClimbRepo seam', () => {
    expect(getRepo()).toBeInstanceOf(DexieClimbRepo);
  });
});
