import { describe, it, expect } from 'vitest';
import { adapt } from '../../src/domain/adaptation';
import type {
  CheckIn,
  LoadMetrics,
  LoggedBlock,
  PlannedSession,
  SessionLog,
} from '../../src/domain/types';

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

function logBlock(blockId: string, overrides: Partial<LoggedBlock> = {}): LoggedBlock {
  return {
    blockId,
    setsCompleted: 6,
    gradesAttempted: [],
    gradesSent: [],
    rpe: 7,
    ...overrides,
  };
}

function sessionLog(id: string, date: string, blocks: LoggedBlock[]): SessionLog {
  return {
    id,
    date,
    warmupCompleted: true,
    blocks,
    sessionRPE: blocks.reduce((m, b) => Math.max(m, b.rpe), 0),
    durationMin: 60,
  };
}

describe('adapt — progression (rules 6-7)', () => {
  it('progresses targetGrade when last 2 matching logs show sends at or above target at low RPE (rule 6)', () => {
    const logs = [
      sessionLog('log-1', '2026-06-08', [
        logBlock('m', { gradesAttempted: [5, 6], gradesSent: [5, 6], rpe: 7 }),
      ]),
      sessionLog('log-2', '2026-06-05', [
        logBlock('m', { gradesAttempted: [5, 6], gradesSent: [5], rpe: 8 }),
      ]),
    ];
    const r = adapt(session(), neutralCheckIn(), logs, okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.targetGrade).toBe(6);
    expect(r.changes.some((c) => c.ruleId === 'progression')).toBe(true);
  });

  it('does NOT progress when only 1 matching log exists (not enough data)', () => {
    const logs = [
      sessionLog('log-1', '2026-06-08', [logBlock('m', { gradesSent: [5, 6], rpe: 7 })]),
    ];
    const r = adapt(session(), neutralCheckIn(), logs, okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.targetGrade).toBe(5);
    expect(r.changes.some((c) => c.ruleId === 'progression')).toBe(false);
    expect(r.changes.some((c) => c.ruleId === 'regression')).toBe(false);
  });

  it('regresses targetGrade when last 2 matching logs show no sends at or above target (rule 7)', () => {
    const logs = [
      sessionLog('log-1', '2026-06-08', [
        logBlock('m', { gradesAttempted: [4, 5], gradesSent: [4], rpe: 9 }),
      ]),
      sessionLog('log-2', '2026-06-05', [
        logBlock('m', { gradesAttempted: [4], gradesSent: [], rpe: 9 }),
      ]),
    ];
    const r = adapt(session(), neutralCheckIn(), logs, okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.targetGrade).toBe(4);
    expect(r.changes.some((c) => c.ruleId === 'regression')).toBe(true);
  });

  it('eases a V0 climber toward VB (never UP to V1) and renders VB, not "V-1" (BC-44)', () => {
    const s = session();
    s.blocks[1]!.targetGrade = 0; // V0 main block
    const logs = [
      sessionLog('log-1', '2026-06-08', [
        logBlock('m', { gradesAttempted: [0], gradesSent: [], rpe: 9 }),
      ]),
      sessionLog('log-2', '2026-06-05', [
        logBlock('m', { gradesAttempted: [0], gradesSent: [], rpe: 9 }),
      ]),
    ];
    const r = adapt(s, neutralCheckIn(), logs, okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.targetGrade).toBe(-1); // eased to VB, not forced up to V1
    const reason = r.changes.find((c) => c.ruleId === 'regression')?.reason ?? '';
    expect(reason).toContain('VB');
    expect(reason).not.toContain('V-1');
  });

  it('pain (rule 1) takes priority over crushing progression rule 6', () => {
    const ci = neutralCheckIn();
    ci.pain = { shoulder: 2 };
    const logs = [
      sessionLog('log-1', '2026-06-08', [logBlock('m', { gradesSent: [5, 6], rpe: 7 })]),
      sessionLog('log-2', '2026-06-05', [logBlock('m', { gradesSent: [5], rpe: 8 })]),
    ];
    const r = adapt(session(), ci, logs, okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    // volume cut, not increased — safety wins
    expect(main?.sets).toBeLessThanOrEqual(
      session().blocks.find((b) => b.category === 'main')!.sets,
    );
    expect(r.changes[0]?.ruleId).toBe('pain');
  });

  it('is a no-op on a block that has no targetGrade (e.g. warmup)', () => {
    const s = session();
    s.blocks[1]!.targetGrade = undefined; // main block has no target
    const logs = [
      sessionLog('log-1', '2026-06-08', [logBlock('m', { gradesSent: [5], rpe: 7 })]),
      sessionLog('log-2', '2026-06-05', [logBlock('m', { gradesSent: [5], rpe: 8 })]),
    ];
    const r = adapt(s, neutralCheckIn(), logs, okMetrics);
    expect(r.changes.some((c) => c.ruleId === 'progression')).toBe(false);
    expect(r.changes.some((c) => c.ruleId === 'regression')).toBe(false);
  });

  it('neither progresses nor regresses when logs show mixed results', () => {
    const logs = [
      sessionLog('log-1', '2026-06-08', [logBlock('m', { gradesSent: [5, 6], rpe: 7 })]),
      sessionLog('log-2', '2026-06-05', [
        logBlock('m', { gradesSent: [3], rpe: 9 }), // below target
      ]),
    ];
    const r = adapt(session(), neutralCheckIn(), logs, okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.targetGrade).toBe(5); // unchanged
    expect(r.changes.some((c) => c.ruleId === 'progression')).toBe(false);
    expect(r.changes.some((c) => c.ruleId === 'regression')).toBe(false);
  });
});

// BC-35 — exact-boundary kills for the safety operators. 100% branch coverage proves
// the lines ran; these prove the *thresholds* are exact (mutation testing pins them):
// the domain-rule-authoring skill mandates boundary tests at ACWR 1.3 and 1.5.
describe('adapt — threshold boundaries (mutation-hardening)', () => {
  const ruleIds = (r: ReturnType<typeof adapt>) => r.changes.map((c) => c.ruleId);

  it('ACWR exactly 1.5 is caution, NOT a deload (rule 3 is > 1.5, strict)', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 450, chronic: 300, acwr: 1.5 });
    expect(ruleIds(r)).toContain('acwr-caution');
    expect(ruleIds(r)).not.toContain('acwr-high');
  });

  it('ACWR just above 1.5 (1.51) forces a deload', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 453, chronic: 300, acwr: 1.51 });
    expect(ruleIds(r)).toContain('acwr-high');
  });

  it('ACWR exactly 1.3 is the caution floor (rule 4 is >= 1.3, inclusive)', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 390, chronic: 300, acwr: 1.3 });
    expect(ruleIds(r)).toContain('acwr-caution');
  });

  it('ACWR just below 1.3 (1.29) triggers no load rule', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 387, chronic: 300, acwr: 1.29 });
    expect(ruleIds(r)).not.toContain('acwr-caution');
    expect(ruleIds(r)).not.toContain('acwr-high');
  });

  it('fatigue exactly 4 fires the fatigue rule (>= 4, inclusive)', () => {
    const ci = { ...neutralCheckIn(), overallFatigue: 4, sleepQuality: 4 };
    expect(ruleIds(adapt(session(), ci, [], okMetrics))).toContain('fatigue');
  });

  it('fatigue 3 with good sleep does NOT fire the fatigue rule', () => {
    const ci = { ...neutralCheckIn(), overallFatigue: 3, sleepQuality: 4 };
    expect(ruleIds(adapt(session(), ci, [], okMetrics))).not.toContain('fatigue');
  });

  it('sleep exactly 2 fires the fatigue rule on its own (<= 2, inclusive; OR not AND)', () => {
    const ci = { ...neutralCheckIn(), overallFatigue: 2, sleepQuality: 2 };
    expect(ruleIds(adapt(session(), ci, [], okMetrics))).toContain('fatigue');
  });

  it('pain cuts main volume to exactly half (6 → 3 sets) and leaves non-main sets alone', () => {
    const r = adapt(session(), { ...neutralCheckIn(), pain: { pip: 2 } }, [], okMetrics);
    expect(totalMainSets(r.adjustedSession)).toBe(3); // Math.max(1, round(6 × 0.5)) — not min
    expect(r.adjustedSession.blocks.find((b) => b.id === 'wu')?.sets).toBe(10); // warm-up untouched
  });

  it('pain forces only MAIN grips open — a non-main block keeps its grip', () => {
    const s = session();
    const cooldown = s.blocks.find((b) => b.id === 'cd');
    if (cooldown) cooldown.grip = 'crimp';
    const r = adapt(s, { ...neutralCheckIn(), pain: { shoulder: 2 } }, [], okMetrics);
    expect(r.adjustedSession.blocks.find((b) => b.id === 'cd')?.grip).toBe('crimp');
  });

  it('soreness mandates the warm-up and lowers main RPE to exactly targetRPE − 1 (floor 5)', () => {
    const r = adapt(session(), { ...neutralCheckIn(), soreness: { pip: 2 } }, [], okMetrics);
    expect(r.warmupMandatory).toBe(true); // not false
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.targetRPE).toBe(8); // Math.max(5, 9 − 1) — not min
  });

  it('progression counts a single qualifying send among misses (some, not every)', () => {
    const logs = [
      sessionLog('log-1', '2026-06-08', [logBlock('m', { gradesSent: [3, 6], rpe: 8 })]),
      sessionLog('log-2', '2026-06-05', [logBlock('m', { gradesSent: [4, 5], rpe: 8 })]),
    ];
    expect(ruleIds(adapt(session(), neutralCheckIn(), logs, okMetrics))).toContain('progression');
  });

  it('a send exactly AT target counts as hitting it — no regression (>=, not >)', () => {
    const logs = [
      sessionLog('log-1', '2026-06-08', [logBlock('m', { gradesSent: [5], rpe: 9 })]),
      sessionLog('log-2', '2026-06-05', [logBlock('m', { gradesSent: [5], rpe: 9 })]),
    ];
    expect(ruleIds(adapt(session(), neutralCheckIn(), logs, okMetrics))).not.toContain(
      'regression',
    );
  });

  it('progression needs RPE at or below targetRPE − 1: sends at exactly targetRPE do NOT progress', () => {
    // target grade 5, targetRPE 9 → crushing requires rpe <= 8. Sends at rpe 9 must not bump.
    const atCap = [
      sessionLog('log-1', '2026-06-08', [logBlock('m', { gradesSent: [5, 6], rpe: 9 })]),
      sessionLog('log-2', '2026-06-05', [logBlock('m', { gradesSent: [5], rpe: 9 })]),
    ];
    expect(ruleIds(adapt(session(), neutralCheckIn(), atCap, okMetrics))).not.toContain(
      'progression',
    );

    const belowCap = [
      sessionLog('log-3', '2026-06-08', [logBlock('m', { gradesSent: [5, 6], rpe: 8 })]),
      sessionLog('log-4', '2026-06-05', [logBlock('m', { gradesSent: [5], rpe: 8 })]),
    ];
    expect(ruleIds(adapt(session(), neutralCheckIn(), belowCap, okMetrics))).toContain(
      'progression',
    );
  });
});
