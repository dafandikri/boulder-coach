import { describe, it, expect } from 'vitest';
import { computeLoadMetrics } from '../../src/domain/loadMetrics';
import type { SessionLog } from '../../src/domain/types';

function log(date: string, sessionRPE: number, durationMin: number): SessionLog {
  return {
    id: date,
    date,
    warmupCompleted: true,
    blocks: [],
    sessionRPE,
    durationMin,
  };
}

describe('computeLoadMetrics', () => {
  it('returns zero metrics with no logs', () => {
    const m = computeLoadMetrics([], new Date('2026-06-09'));
    expect(m).toEqual({ acute: 0, chronic: 0, acwr: 0 });
  });

  it('sums acute load over the last 7 days inclusive', () => {
    const logs = [
      log('2026-06-09', 8, 60), // 480, day 0
      log('2026-06-07', 6, 60), // 360, day -2
      log('2026-06-01', 9, 60), // 540, day -8 (excluded from acute)
    ];
    const m = computeLoadMetrics(logs, new Date('2026-06-09'));
    expect(m.acute).toBe(840);
  });

  it('ignores future-dated logs (age < 0 guard)', () => {
    const logs = [
      log('2026-06-09', 8, 60), // today: 480
      log('2026-06-20', 9, 60), // future relative to asOf — excluded
    ];
    const m = computeLoadMetrics(logs, new Date('2026-06-09'));
    expect(m.acute).toBe(480);
    expect(m.chronic).toBe(120); // only the 480 counts: 480/4
  });

  it('computes chronic as 28-day load divided by 4 (weekly-equivalent)', () => {
    const logs = [
      log('2026-06-09', 10, 40), // 400
      log('2026-05-20', 10, 40), // 400, within 28 days
      log('2026-05-01', 10, 40), // 400, older than 28 days (excluded)
    ];
    const m = computeLoadMetrics(logs, new Date('2026-06-09'));
    expect(m.chronic).toBe(200); // (400 + 400) / 4
  });

  it('computes acwr = acute / chronic rounded to 2 decimals', () => {
    const logs = [
      log('2026-06-09', 10, 60), // 600 acute + chronic
      log('2026-05-25', 10, 60), // 600 chronic only (15 days ago)
    ];
    const m = computeLoadMetrics(logs, new Date('2026-06-09'));
    // acute = 600, chronic = (600 + 600)/4 = 300, acwr = 2.0
    expect(m.acute).toBe(600);
    expect(m.chronic).toBe(300);
    expect(m.acwr).toBe(2);
  });
});
