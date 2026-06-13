import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../../src/domain/readiness';
import type { CheckIn, LoadMetrics } from '../../src/domain/types';

/** A fresh, well-recovered mock check-in: great sleep, low fatigue, motivated, no pain. */
function freshCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    date: '2026-06-13',
    sleepQuality: 5,
    overallFatigue: 1,
    soreness: {},
    pain: {},
    motivation: 5,
    ...overrides,
  };
}

const calmLoad: LoadMetrics = { acute: 10, chronic: 10, acwr: 1.0 };

describe('computeReadiness', () => {
  it('scores a fresh, well-recovered day green with a positive driver', () => {
    const r = computeReadiness(freshCheckIn(), calmLoad);
    expect(r.band).toBe('green');
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it('clamps the score to the 0..100 range', () => {
    const wrecked = freshCheckIn({
      sleepQuality: 1,
      overallFatigue: 5,
      soreness: { pip: 3, shoulder: 3 },
      motivation: 1,
    });
    const spiking: LoadMetrics = { acute: 30, chronic: 10, acwr: 3.0 };
    const r = computeReadiness(wrecked, spiking);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('forces red on ANY sharp pain regardless of an otherwise great day (safety bias)', () => {
    const r = computeReadiness(freshCheckIn({ pain: { pip: 1 } }), calmLoad);
    expect(r.band).toBe('red');
    expect(r.drivers[0]!.toLowerCase()).toContain('pain');
  });

  it('forces red when ACWR exceeds 1.5 even with no pain (mirrors rule 3)', () => {
    const spiking: LoadMetrics = { acute: 20, chronic: 10, acwr: 1.6 };
    const r = computeReadiness(freshCheckIn(), spiking);
    expect(r.band).toBe('red');
    expect(r.drivers.some((d) => d.toLowerCase().includes('acwr'))).toBe(true);
  });

  it('flags a load-creep driver in the 1.3..1.5 caution band without forcing red', () => {
    const creeping: LoadMetrics = { acute: 14, chronic: 10, acwr: 1.4 };
    const r = computeReadiness(freshCheckIn(), creeping);
    expect(r.band).not.toBe('red'); // caution, not danger
    expect(r.drivers.some((d) => d.toLowerCase().includes('acwr'))).toBe(true);
  });

  it('lands amber for a middling day and names the top drivers', () => {
    const r = computeReadiness(
      freshCheckIn({ sleepQuality: 2, overallFatigue: 4, motivation: 3 }),
      calmLoad,
    );
    expect(r.band).toBe('amber');
    expect(r.drivers).toContain('high fatigue');
    expect(r.drivers).toContain('rough sleep');
  });

  it('surfaces soreness and low motivation as drivers', () => {
    const r = computeReadiness(freshCheckIn({ soreness: { elbow: 2 }, motivation: 2 }), calmLoad);
    expect(r.drivers.some((d) => d.includes('elbow'))).toBe(true);
    expect(r.drivers).toContain('low motivation');
  });

  it('drops to red on a low score even without a pain/ACWR override', () => {
    const r = computeReadiness(
      freshCheckIn({ sleepQuality: 1, overallFatigue: 5, motivation: 1 }),
      calmLoad,
    );
    expect(r.band).toBe('red');
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it('returns a neutral driver when an amber/red day flags nothing specific', () => {
    // moderate sleep/fatigue lowers the score without crossing any driver threshold.
    const r = computeReadiness(
      freshCheckIn({ sleepQuality: 3, overallFatigue: 3, motivation: 3 }),
      calmLoad,
    );
    expect(r.drivers.length).toBeGreaterThan(0);
  });
});
