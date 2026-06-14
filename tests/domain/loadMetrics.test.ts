import { describe, it, expect } from 'vitest';
import { computeLoadMetrics } from '../../src/domain/loadMetrics';
import type { SessionLog } from '../../src/domain/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO date `ageDays` before `asOf` (UTC, date-only). */
function iso(asOf: Date, ageDays: number): string {
  return new Date(asOf.getTime() - ageDays * DAY_MS).toISOString().slice(0, 10);
}

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

/**
 * EWMA-ACWR (Williams 2017), seeded for cold-start stability.
 *
 * Daily load = sessionRPE × durationMin, summed per calendar day. Acute and chronic
 * are exponentially-weighted moving averages of the daily-load series with decay
 * constants λ = 2/(N+1) for N = 7 (acute) and N = 28 (chronic). Both EWMAs are seeded
 * with the FIRST in-window day's load, so the ratio starts at exactly 1.0 — a climber's
 * first session/week never reads as a false 4× spike (the cold-start bug the rolling
 * acute/(chronic÷4) method produced). ACWR = acute / chronic, 0 when chronic is 0.
 */
const asOf = new Date('2026-06-29');

describe('computeLoadMetrics — EWMA-ACWR', () => {
  it('returns zero metrics with no logs', () => {
    expect(computeLoadMetrics([], asOf)).toEqual({ acute: 0, chronic: 0, acwr: 0 });
  });

  it('a single session reads as ACWR 1.0, not a spike (cold-start seed)', () => {
    // One 600-load session today: both EWMAs seed to 600 → ratio exactly 1.0.
    const m = computeLoadMetrics([log(iso(asOf, 0), 10, 60)], asOf);
    expect(m.acute).toBe(600);
    expect(m.chronic).toBe(600);
    expect(m.acwr).toBe(1);
  });

  it('a first training week reads as normal load, never a 4× injury spike', () => {
    // Three sessions in the last 7 days and nothing before — the exact case that made
    // the old acute/(chronic÷4) method report ACWR ≈ 4 and force a bogus deload.
    const logs = [log(iso(asOf, 0), 10, 60), log(iso(asOf, 2), 10, 60), log(iso(asOf, 4), 10, 60)];
    const m = computeLoadMetrics(logs, asOf);
    expect(m.acwr).toBeGreaterThan(0);
    expect(m.acwr).toBeLessThan(1.3); // below the caution band → no false alarm
  });

  it('computes EWMA acute/chronic and the ratio for a two-day series', () => {
    // seed day (age 1) load 400 → ewmaA = ewmaC = 400.
    // today (age 0) load 800 →
    //   ewmaA = 0.25·800 + 0.75·400 = 500
    //   ewmaC = (2/29)·800 + (27/29)·400 = 12400/29 = 427.586…
    //   acwr  = 500 / 427.586… = 1.1694 → 1.17
    const logs = [log(iso(asOf, 1), 10, 40), log(iso(asOf, 0), 10, 80)];
    const m = computeLoadMetrics(logs, asOf);
    expect(m.acute).toBe(500);
    expect(m.chronic).toBe(428);
    expect(m.acwr).toBe(1.17);
  });

  it('still flags a genuine load spike on an established base (ACWR > 1.5 → deload)', () => {
    // ~3 weeks of low base load, then a week at 10× — a real acute spike must still
    // cross the deload threshold so the safety rule fires when it should.
    const logs: SessionLog[] = [];
    for (let age = 27; age >= 7; age--) logs.push(log(iso(asOf, age), 10, 10)); // base 100/day
    for (let age = 6; age >= 0; age--) logs.push(log(iso(asOf, age), 10, 100)); // spike 1000/day
    const m = computeLoadMetrics(logs, asOf);
    expect(m.acwr).toBeGreaterThan(1.5);
  });

  it('reports ACWR 0 when the only logged load is zero (no divide-by-zero)', () => {
    // A session logged with 0 duration → 0 load → chronic EWMA seeds to 0.
    const m = computeLoadMetrics([log(iso(asOf, 0), 8, 0)], asOf);
    expect(m).toEqual({ acute: 0, chronic: 0, acwr: 0 });
  });

  it('ignores future-dated logs (age < 0 guard)', () => {
    const logs = [log(iso(asOf, 0), 10, 60), log(iso(asOf, -5), 10, 60)];
    const m = computeLoadMetrics(logs, asOf);
    // Only today's session counts → seed-only → ratio 1.0.
    expect(m.acute).toBe(600);
    expect(m.acwr).toBe(1);
  });

  it('ignores logs older than the warm-up window (≥ 42 days)', () => {
    // An ancient log plus one recent session behaves like the recent session alone;
    // a long layoff is BC-08's concern, not a chronic-baseline contributor here.
    const logs = [log(iso(asOf, 60), 10, 200), log(iso(asOf, 0), 10, 60)];
    const m = computeLoadMetrics(logs, asOf);
    expect(m.acute).toBe(600);
    expect(m.chronic).toBe(600);
    expect(m.acwr).toBe(1);
  });
});
