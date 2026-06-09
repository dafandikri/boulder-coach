import { describe, it, expect } from 'vitest';
import { adapt } from '../../src/domain/adaptation';
import type { CheckIn, LoadMetrics, PlannedSession } from '../../src/domain/types';

function neutralCheckIn(): CheckIn {
  return {
    date: '2026-06-09',
    sleepQuality: 4,
    overallFatigue: 2,
    soreness: {},
    pain: {},
    motivation: 4,
  };
}

function session(): PlannedSession {
  return {
    id: 's1',
    programId: 'p',
    weekIndex: 0,
    dayIndex: 0,
    type: 'limit-boulder',
    blocks: [
      {
        id: 'wu',
        name: 'Potentiate: easy climbing',
        category: 'warmup',
        grip: 'open-hand',
        sets: 10,
        targetRPE: 4,
      },
      {
        id: 'm',
        name: 'Limit bouldering',
        category: 'main',
        grip: 'crimp',
        sets: 6,
        targetGrade: 5,
        targetRPE: 9,
      },
      {
        id: 'cd',
        name: 'Cooldown prehab',
        category: 'cooldown',
        grip: 'open-hand',
        sets: 2,
        targetRPE: 4,
      },
    ],
  };
}

const okMetrics: LoadMetrics = { acute: 300, chronic: 300, acwr: 1.0 };

function totalMainSets(s: PlannedSession): number {
  return s.blocks.filter((b) => b.category === 'main').reduce((n, b) => n + b.sets, 0);
}

describe('adapt — safety first', () => {
  it('on sharp pain: cuts main volume ~50%, swaps in prehab, mandates warm-up', () => {
    const ci = neutralCheckIn();
    ci.pain = { pip: 2 };
    const r = adapt(session(), ci, [], okMetrics);
    expect(r.warmupMandatory).toBe(true);
    expect(totalMainSets(r.adjustedSession)).toBeLessThanOrEqual(3);
    expect(r.adjustedSession.blocks.some((b) => b.category === 'prehab')).toBe(true);
    expect(r.changes[0]!.ruleId).toBe('pain');
  });

  it('on TFCC pain: removes crimp/sloper main grip work', () => {
    const ci = neutralCheckIn();
    ci.pain = { 'wrist-tfcc': 2 };
    const r = adapt(session(), ci, [], okMetrics);
    const main = r.adjustedSession.blocks.filter((b) => b.category === 'main');
    expect(main.every((b) => b.grip !== 'crimp')).toBe(true);
  });

  it('on soreness (no pain): swaps crimp grip to open-hand', () => {
    const ci = neutralCheckIn();
    ci.soreness = { pip: 2 };
    const r = adapt(session(), ci, [], okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.grip).toBe('open-hand');
    expect(r.changes.some((c) => c.ruleId === 'soreness')).toBe(true);
  });

  it('ignores a flagged body part with no positive severity (undefined/zero)', () => {
    const ci = neutralCheckIn();
    ci.soreness = { pip: undefined }; // key present, but no real severity
    const r = adapt(session(), ci, [], okMetrics);
    expect(r.changes).toHaveLength(0);
    expect(r.warmupMandatory).toBe(false);
  });

  it('pain on a session whose main is already open-hand keeps it open-hand', () => {
    const s = session();
    s.blocks[1]!.grip = 'open-hand'; // main already open-hand
    const ci = neutralCheckIn();
    ci.pain = { pip: 1 };
    const r = adapt(s, ci, [], okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.grip).toBe('open-hand');
  });

  it('on soreness with a mixed-grip main: swaps mixed to open-hand', () => {
    const s = session();
    s.blocks[1]!.grip = 'mixed';
    const ci = neutralCheckIn();
    ci.soreness = { shoulder: 1 };
    const r = adapt(s, ci, [], okMetrics);
    expect(r.adjustedSession.blocks.find((b) => b.category === 'main')?.grip).toBe('open-hand');
  });

  it('on soreness with an already open-hand main: leaves grip but still lowers RPE', () => {
    const s = session();
    s.blocks[1]!.grip = 'open-hand';
    const before = s.blocks[1]!.targetRPE;
    const ci = neutralCheckIn();
    ci.soreness = { shoulder: 1 };
    const r = adapt(s, ci, [], okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.grip).toBe('open-hand');
    expect(main!.targetRPE).toBeLessThan(before);
  });

  it('pain takes priority over a "crushing it" progression', () => {
    const ci = neutralCheckIn();
    ci.pain = { shoulder: 3 };
    const r = adapt(session(), ci, [], okMetrics);
    // volume cut, not increased
    expect(totalMainSets(r.adjustedSession)).toBeLessThan(totalMainSets(session()));
  });
});

describe('adapt — load', () => {
  it('forces a deload when ACWR > 1.5', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 600, chronic: 300, acwr: 2.0 });
    expect(totalMainSets(r.adjustedSession)).toBeLessThan(totalMainSets(session()));
    expect(r.changes.some((c) => c.ruleId === 'acwr-high')).toBe(true);
  });

  it('caps intensity (no new max) when ACWR 1.3–1.5', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 420, chronic: 300, acwr: 1.4 });
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main!.targetRPE).toBeLessThanOrEqual(8);
    expect(r.changes.some((c) => c.ruleId === 'acwr-caution')).toBe(true);
  });
});

describe('adapt — fatigue & default', () => {
  it('trims volume on poor sleep / high fatigue', () => {
    const ci = neutralCheckIn();
    ci.sleepQuality = 1;
    ci.overallFatigue = 5;
    const r = adapt(session(), ci, [], okMetrics);
    expect(totalMainSets(r.adjustedSession)).toBeLessThan(totalMainSets(session()));
    expect(r.changes.some((c) => c.ruleId === 'fatigue')).toBe(true);
  });

  it('returns the session unchanged on a neutral day', () => {
    const r = adapt(session(), neutralCheckIn(), [], okMetrics);
    expect(totalMainSets(r.adjustedSession)).toBe(totalMainSets(session()));
    expect(r.changes).toHaveLength(0);
    expect(r.warmupMandatory).toBe(false);
  });
});
