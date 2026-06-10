import { describe, it, expect } from 'vitest';
import { isExpired } from '../../scripts/crew/lib/lease.mjs';

describe('isExpired (mock clock)', () => {
  const claim = { heartbeat: '2026-06-10T10:00:00.000Z' };
  const at = (iso: string) => new Date(iso).getTime();
  it('is not expired within the lease window', () => {
    expect(isExpired(claim, at('2026-06-10T10:20:00.000Z'), 1800)).toBe(false);
  });
  it('is expired past the lease window', () => {
    expect(isExpired(claim, at('2026-06-10T10:31:00.000Z'), 1800)).toBe(true);
  });
});
