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

  it('sanitizes a valid log with sends exceeding attempts (BC-65)', () => {
    const raw = goodLog({
      id: 'mock-corrupt',
      blocks: [
        {
          blockId: 'm',
          setsCompleted: 3,
          gradesAttempted: [5, 5],
          gradesSent: [5, 5, 5],
          rpe: 8,
        },
      ],
    });
    const { valid, quarantined } = partitionLogs([raw]);
    expect(quarantined).toHaveLength(0);
    expect(valid[0]!.blocks[0]!.gradesSent).toEqual([5, 5]);
    expect(valid[0]!.blocks[0]!.gradesAttempted).toEqual([5, 5]);
  });

  // BC-65 regression guard: validateLog does NOT deep-validate block contents, so a
  // top-level-valid log can carry a malformed block (truncated write / hand-edit). The
  // BC-65 sanitize step iterates block.gradesAttempted/gradesSent — if those aren't
  // arrays it must NOT throw inside the quarantine boundary (one bad block previously
  // took down the ENTIRE getLogs load). A malformed block is corruption → quarantine it,
  // and never crash partitionLogs.
  it('quarantines (never throws on) a log whose block grade fields are not arrays (BC-65)', () => {
    const malformed = goodLog({
      id: 'mock-bad-block',
      blocks: [
        { blockId: 'm', setsCompleted: 1, rpe: 8 } as unknown as SessionLog['blocks'][number],
      ],
    });
    const good = goodLog({ id: 'mock-ok' });
    let result!: ReturnType<typeof partitionLogs>;
    expect(() => {
      result = partitionLogs([malformed, good]);
    }).not.toThrow();
    // the good log still loads; the malformed one is quarantined, not silently dropped
    expect(result.valid.map((l) => l.id)).toEqual(['mock-ok']);
    expect(result.quarantined).toHaveLength(1);
    expect(result.quarantined[0]?.reason.length).toBeGreaterThan(0);
  });
});
