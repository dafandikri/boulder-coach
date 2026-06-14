import { describe, it, expect } from 'vitest';
import { RECOVERY_COPY, RECOVERY_ACTIONS, safeErrorDigest } from '../../src/app/lib/errorRecovery';

describe('errorRecovery (BC-33)', () => {
  it('offers a reload and an export-your-data action', () => {
    expect(RECOVERY_ACTIONS.some((a) => a.kind === 'reload')).toBe(true);
    const exportAction = RECOVERY_ACTIONS.find((a) => a.kind === 'link');
    expect(exportAction?.href).toBe('/profile');
  });

  it('reassures the user their data is safe', () => {
    expect(RECOVERY_COPY.title.length).toBeGreaterThan(0);
    expect(RECOVERY_COPY.message.toLowerCase()).toContain('safe');
  });

  it('digests an Error into a short, stack-free reference', () => {
    const err = new TypeError('boom happened');
    const err2 = err; // give it a stack
    err2.stack = 'TypeError: boom happened\n    at secret/path/file.ts:42:7';
    const digest = safeErrorDigest(err2);
    expect(digest).toBe('TypeError: boom happened');
    expect(digest).not.toContain('secret/path'); // never leak the stack
    expect(digest).not.toContain('\n');
  });

  it('truncates an overlong message', () => {
    const digest = safeErrorDigest(new Error('x'.repeat(500)));
    expect(digest.length).toBeLessThanOrEqual(140);
  });

  it('handles a non-Error throw without crashing', () => {
    expect(safeErrorDigest('just a string')).toBe('Unknown error');
    expect(safeErrorDigest(undefined)).toBe('Unknown error');
  });
});
