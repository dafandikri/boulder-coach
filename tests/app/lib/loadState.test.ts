import { describe, it, expect } from 'vitest';
import {
  toLoadState,
  toOptionalLoadState,
  type LoadState,
  type OptionalLoadState,
} from '@/app/lib/loadState';

// A tiny stand-in payload (mock data) — the builder is generic, so the shape is
// irrelevant; we only assert how it routes success/failure/emptiness.
interface MockPayload {
  label: string;
}
const mockPayload: MockPayload = { label: 'mock-session' };

describe('toLoadState (load that always yields data on success)', () => {
  it('maps a resolved value to a ready state carrying the data', () => {
    const state: LoadState<MockPayload> = toLoadState({ ok: true, data: mockPayload });
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.data).toEqual(mockPayload);
  });

  it('maps a failure to an error state carrying a human-readable message', () => {
    const state = toLoadState<MockPayload>({ ok: false, error: new Error('dummy boom') });
    expect(state.status).toBe('error');
    if (state.status !== 'error') throw new Error('expected error');
    expect(state.message).toMatch(/boom/i);
  });

  it('falls back to a generic message when the error is not an Error', () => {
    const state = toLoadState<MockPayload>({ ok: false, error: 'not-an-error-object' });
    expect(state.status).toBe('error');
    if (state.status !== 'error') throw new Error('expected error');
    expect(state.message.length).toBeGreaterThan(0);
  });
});

describe('toOptionalLoadState (load whose success may be absent → empty)', () => {
  it('routes a present value to ready', () => {
    const state: OptionalLoadState<MockPayload> = toOptionalLoadState({
      ok: true,
      data: mockPayload,
    });
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') throw new Error('expected ready');
    expect(state.data).toEqual(mockPayload);
  });

  it('routes an absent value (undefined) to empty, not error', () => {
    const state = toOptionalLoadState<MockPayload>({ ok: true, data: undefined });
    expect(state.status).toBe('empty');
  });

  it('routes an absent value (null) to empty', () => {
    const state = toOptionalLoadState<MockPayload>({ ok: true, data: null });
    expect(state.status).toBe('empty');
  });

  it('routes a failure to error', () => {
    const state = toOptionalLoadState<MockPayload>({ ok: false, error: new Error('dummy fail') });
    expect(state.status).toBe('error');
    if (state.status !== 'error') throw new Error('expected error');
    expect(state.message).toMatch(/fail/i);
  });
});
