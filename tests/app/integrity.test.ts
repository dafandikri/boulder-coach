import { describe, it, expect } from 'vitest';
import { validateLog, partitionLogs } from '../../src/app/lib/integrity';
import type { SessionLog } from '../../src/domain/types';

function goodLog(over: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 'mock-log-1',
    date: '2026-06-09',
    warmupCompleted: true,
    blocks: [],
    sessionRPE: 8,
    durationMin: 60,
    ...over,
  };
}

describe('validateLog (BC-32)', () => {
  it('accepts a well-formed log', () => {
    const r = validateLog(goodLog());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('mock-log-1');
  });

  it('rejects a non-object', () => {
    expect(validateLog(null).ok).toBe(false);
    expect(validateLog('mock-not-a-log').ok).toBe(false);
  });

  it('rejects a log with a non-numeric sessionRPE (would NaN the load engine)', () => {
    const r = validateLog({ ...goodLog(), sessionRPE: 'eight' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain('sessionrpe');
  });

  it('rejects a log with a NaN duration', () => {
    expect(validateLog({ ...goodLog(), durationMin: Number.NaN }).ok).toBe(false);
  });

  it('rejects a log missing its id or date', () => {
    expect(validateLog({ ...goodLog(), id: undefined }).ok).toBe(false);
    expect(validateLog({ ...goodLog(), date: 42 }).ok).toBe(false);
  });

  it('rejects a log whose blocks are not an array', () => {
    expect(validateLog({ ...goodLog(), blocks: 'nope' }).ok).toBe(false);
  });

  it('rejects a log whose warmupCompleted is not a boolean', () => {
    expect(validateLog({ ...goodLog(), warmupCompleted: 'yes' }).ok).toBe(false);
  });

  it('returns a typed result, never throws, on garbage input', () => {
    expect(() => validateLog(Symbol('x'))).not.toThrow();
    expect(validateLog(Symbol('x')).ok).toBe(false);
  });
});

describe('partitionLogs (BC-32)', () => {
  it('separates valid logs from quarantined corrupt records', () => {
    const raw: unknown[] = [
      goodLog({ id: 'mock-ok-1' }),
      { ...goodLog(), sessionRPE: 'bad', id: 'mock-bad' },
      goodLog({ id: 'mock-ok-2' }),
      null,
    ];
    const { valid, quarantined } = partitionLogs(raw);
    expect(valid.map((l) => l.id)).toEqual(['mock-ok-1', 'mock-ok-2']);
    expect(quarantined).toHaveLength(2);
    expect(quarantined[0]?.reason.length).toBeGreaterThan(0);
  });

  it('returns all valid when nothing is corrupt', () => {
    const { valid, quarantined } = partitionLogs([goodLog(), goodLog({ id: 'mock-2' })]);
    expect(valid).toHaveLength(2);
    expect(quarantined).toHaveLength(0);
  });
});
