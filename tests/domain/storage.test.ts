import { describe, it, expect } from 'vitest';
import {
  requestPersistence,
  shouldWarnEviction,
  type StorageManagerLike,
} from '../../src/app/lib/storage';

// BC-31 — request durable storage and decide whether to warn about eviction.
// All training history lives in evictable IndexedDB (BC-10 named this the
// data-loss risk). `navigator.storage.persist()` asks the browser to make it
// durable; the decision logic is pure + injectable so the page stays I/O-only.

describe('requestPersistence (BC-31)', () => {
  it('returns "persisted" when the browser grants durable storage', async () => {
    const storage: StorageManagerLike = {
      persist: () => Promise.resolve(true),
    };
    expect(await requestPersistence(storage)).toBe('persisted');
  });

  it('returns "transient" when the browser denies durable storage', async () => {
    const storage: StorageManagerLike = {
      persist: () => Promise.resolve(false),
    };
    expect(await requestPersistence(storage)).toBe('transient');
  });

  it('returns "unsupported" when the Storage API is absent', async () => {
    expect(await requestPersistence(undefined)).toBe('unsupported');
  });

  it('returns "unsupported" when persist() is not a function (partial support)', async () => {
    const storage = {} as StorageManagerLike;
    expect(await requestPersistence(storage)).toBe('unsupported');
  });
});

describe('shouldWarnEviction (BC-31)', () => {
  it('warns when storage is transient and the user has not dismissed', () => {
    expect(shouldWarnEviction('transient', false)).toBe(true);
  });

  it('stays quiet once the user has dismissed the warning', () => {
    expect(shouldWarnEviction('transient', true)).toBe(false);
  });

  it('never warns when storage is durable (persisted)', () => {
    expect(shouldWarnEviction('persisted', false)).toBe(false);
  });

  it('never cries wolf when persistence is unknown (unsupported)', () => {
    expect(shouldWarnEviction('unsupported', false)).toBe(false);
  });
});
