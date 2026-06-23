import { describe, it, expect } from 'vitest';
import {
  detectLayoff,
  generateProgram,
  LAYOFF_GAP_DAYS,
  PHASE_PATTERN,
  reEntryReRamp,
  weekSummary,
} from '../../src/domain/periodization';
import { hasRichContent } from '../../src/domain/exerciseContent';
import type { PlannedSession, SessionLog, UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5,
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

/** A minimal logged session on `date` — only fields the layoff rule reads matter. */
function mockLogOn(date: string): SessionLog {
  return {
    id: `mock-log-${date}`,
    date,
    warmupCompleted: true,
    blocks: [],
    sessionRPE: 7,
    durationMin: 60,
  };
}

describe('generateProgram', () => {
  it('builds a 6-week waved mesocycle', () => {
    const p = generateProgram(profile, '2026-06-09');
    expect(p.lengthWeeks).toBe(6);
    expect(p.weeks).toHaveLength(6);
    expect(p.weeks.map((w) => w.phase)).toEqual(PHASE_PATTERN);
  });

  it('schedules sessionsPerWeek sessions in each week', () => {
    const p = generateProgram(profile, '2026-06-09');
    for (const w of p.weeks) {
      expect(w.sessions).toHaveLength(3);
    }
  });

  it('includes a non-empty warm-up plus main work in each session', () => {
    const p = generateProgram(profile, '2026-06-09');
    const s = p.weeks[0]!.sessions[0]!;
    expect(s.blocks.some((b) => b.category === 'warmup')).toBe(true);
    expect(s.blocks.some((b) => b.category === 'main')).toBe(true);
  });

  it('shapes the baseline conservatively for a prior injury (BC-29)', () => {
    const injured = generateProgram({ ...profile, injuryHistory: ['pip'] }, '2026-06-09');
    const healthy = generateProgram(profile, '2026-06-09');
    const injuredS = injured.weeks[0]!.sessions[0]!;
    const healthyS = healthy.weeks[0]!.sessions[0]!;

    // a finger injury adds prehab and removes crimp/mixed grips from the session
    expect(injuredS.blocks.some((b) => b.id === 'injury-prehab-pip')).toBe(true);
    expect(injuredS.blocks.every((b) => b.grip !== 'crimp' && b.grip !== 'mixed')).toBe(true);
    // additive-safety: never more main climbing volume than the healthy baseline
    const mainSets = (s: typeof injuredS) =>
      s.blocks.filter((b) => b.category === 'main').reduce((n, b) => n + b.sets, 0);
    expect(mainSets(injuredS)).toBeLessThanOrEqual(mainSets(healthyS));
  });

  it('targets at or above current grade on limit days in hard weeks', () => {
    const p = generateProgram(profile, '2026-06-09');
    const limit = p.weeks[0]!.sessions.find((s) => s.type === 'limit-boulder');
    const mainBlock = limit?.blocks.find((b) => b.category === 'main');
    expect(mainBlock?.targetGrade).toBeGreaterThanOrEqual(profile.currentGrade);
  });

  it('floors a VB beginner at the scale floor, never forcing easier days up to V1 (BC-44)', () => {
    const vb = generateProgram({ ...profile, currentGrade: -1, goalGrade: 3 }, '2026-06-09');
    for (const w of vb.weeks) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          if (b.targetGrade !== undefined) {
            // never below the VB floor, and the easier (power-endurance/volume) days
            // must not be floored UP past a VB climber's own grade.
            expect(b.targetGrade).toBeGreaterThanOrEqual(-1);
            expect(b.targetGrade).toBeLessThanOrEqual(0); // currentGrade(-1) + peak bump(+1)
          }
        }
      }
    }
  });

  it('supports 1..7 sessions/week with a safe rotation (BC-45)', () => {
    for (let n = 1; n <= 7; n++) {
      const p = generateProgram({ ...profile, sessionsPerWeek: n }, '2026-06-09');
      const types = p.weeks[0]!.sessions.map((s) => s.type);
      expect(types).toHaveLength(n);
      // additive-safety: at most ONE limit day and at most one power-endurance day —
      // extra frequency is filled with low-intensity volume/technique + prehab, never more
      // max-effort climbing.
      expect(types.filter((t) => t === 'limit-boulder').length).toBeLessThanOrEqual(1);
      expect(types.filter((t) => t === 'power-endurance').length).toBeLessThanOrEqual(1);
      const hardDays = types.filter((t) => t === 'limit-boulder' || t === 'power-endurance').length;
      expect(hardDays).toBeLessThanOrEqual(2);
    }
  });

  it('gives every main block detailed instructions + an image (BC-47)', () => {
    const p = generateProgram(profile, '2026-06-09');
    for (const w of p.weeks) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          if (b.category === 'main') {
            expect(b.content).toBeDefined();
            expect(b.content!.steps.length).toBeGreaterThan(0);
            expect(b.content!.imageId).toBeTruthy();
          }
        }
      }
    }
  });

  it('gives every block — warm-up, main AND cooldown — rich how-to content (BC-52)', () => {
    // BC-52: nothing in a generated session may ship detail-less. The home page
    // promised a per-block plan; tapping "Start" must never show less.
    const p = generateProgram(profile, '2026-06-09');
    for (const w of p.weeks) {
      for (const s of w.sessions) {
        for (const b of s.blocks) {
          expect(b.content, `block ${b.id} missing content`).toBeDefined();
          expect(hasRichContent(b.content!), `block ${b.id} not rich`).toBe(true);
        }
      }
    }
  });

  it('makes the single weekly session a limit day when sessionsPerWeek is 1', () => {
    const p = generateProgram({ ...profile, sessionsPerWeek: 1 }, '2026-06-09');
    expect(p.weeks[0]!.sessions.map((s) => s.type)).toEqual(['limit-boulder']);
  });

  it('uses a 2-session rotation when sessionsPerWeek is 2', () => {
    const p = generateProgram({ ...profile, sessionsPerWeek: 2 }, '2026-06-09');
    expect(p.weeks[0]!.sessions).toHaveLength(2);
    expect(p.weeks[0]!.sessions.map((s) => s.type)).toEqual(['limit-boulder', 'power-endurance']);
  });

  it('adds an antagonist-prehab day when sessionsPerWeek is 4', () => {
    const p = generateProgram({ ...profile, sessionsPerWeek: 4 }, '2026-06-09');
    expect(p.weeks[0]!.sessions).toHaveLength(4);
    const types = p.weeks[0]!.sessions.map((s) => s.type);
    expect(types).toContain('antagonist-prehab');
    const antagonist = p.weeks[0]!.sessions.find((s) => s.type === 'antagonist-prehab');
    expect(antagonist!.blocks.some((b) => b.category === 'main')).toBe(true);
  });

  it('varies consecutive same-phase weeks in real content, not just ids (BC-48)', () => {
    const p = generateProgram(profile, '2026-06-09');
    expect(p.weeks[0]!.phase).toBe('hard');
    expect(p.weeks[1]!.phase).toBe('hard');
    // Compare the main blocks with ids stripped — real prescription must differ,
    // not just the week-encoded session id.
    const mainOf = (wi: number): unknown =>
      p.weeks[wi]!.sessions.map((s) =>
        s.blocks.filter((b) => b.category === 'main').map(({ id: _id, ...rest }) => rest),
      );
    expect(JSON.stringify(mainOf(0))).not.toBe(JSON.stringify(mainOf(1)));
  });

  it('progressively overloads across consecutive hard weeks (BC-48)', () => {
    const p = generateProgram(profile, '2026-06-09');
    const limitSets = (wi: number): number => {
      const s = p.weeks[wi]!.sessions.find((x) => x.type === 'limit-boulder')!;
      return s.blocks.filter((b) => b.category === 'main').reduce((n, b) => n + b.sets, 0);
    };
    // hard week 1 carries more main volume than hard week 0 (progressive overload).
    expect(limitSets(1)).toBeGreaterThan(limitSets(0));
  });

  it('rotates the technique drill week-to-week in volume sessions (BC-48 absorbs BC-19)', () => {
    const p = generateProgram(profile, '2026-06-09');
    const drillNote = (wi: number): string => {
      const v = p.weeks[wi]!.sessions.find((x) => x.type === 'volume-technique')!;
      const main = v.blocks.find((b) => b.category === 'main')!;
      return main.notes ?? '';
    };
    // week 0 and week 1 volume days name different deliberate drills.
    expect(drillNote(0)).not.toBe(drillNote(1));
    expect(drillNote(0).length).toBeGreaterThan(0);
  });

  it('reads differently for two same-phase weeks via weekSummary (BC-53)', () => {
    const p = generateProgram(profile, '2026-06-09');
    // weeks 0 and 3 are both `hard` but must NOT produce the same plan.
    expect(p.weeks[0]!.phase).toBe('hard');
    expect(p.weeks[3]!.phase).toBe('hard');
    expect(weekSummary(p.weeks[0]!).title).toBe('Build 1');
    expect(weekSummary(p.weeks[3]!).title).toBe('Build 3');
    expect(weekSummary(p.weeks[0]!).detail).not.toBe(weekSummary(p.weeks[3]!).detail);
    expect(weekSummary(p.weeks[0]!).detail.length).toBeGreaterThan(0);
  });

  it('weekSummary describes what to do and why, not a misleading drill focus (BC-53)', () => {
    const p = generateProgram(profile, '2026-06-09');
    // Must NOT mislabel the volume day's rotating drill as the week's whole "focus".
    for (const w of p.weeks) {
      expect(weekSummary(w).detail.toLowerCase()).not.toContain('focus:');
      expect(weekSummary(w).detail.length).toBeGreaterThan(20); // a real sentence
    }
  });

  it('weekSummary titles the deload and peak phases distinctly (BC-53)', () => {
    const p = generateProgram(profile, '2026-06-09');
    // PHASE_PATTERN = hard, hard, deload, hard, peak, deload
    expect(weekSummary(p.weeks[2]!).title).toBe('Deload');
    expect(weekSummary(p.weeks[4]!).title).toBe('Peak');
    // the two deload weeks (mid-cycle vs end-of-cycle) read differently.
    expect(weekSummary(p.weeks[2]!).detail).not.toBe(weekSummary(p.weeks[5]!).detail);
  });

  it('weekSummary expresses progressive overload per build week (BC-53)', () => {
    const p = generateProgram(profile, '2026-06-09');
    // week 1 = second hard week (+1 set, singular), week 3 = third hard week (+2 sets, plural).
    expect(weekSummary(p.weeks[0]!).detail.toLowerCase()).toContain('base');
    expect(weekSummary(p.weeks[1]!).detail).toContain('+1 set');
    expect(weekSummary(p.weeks[1]!).detail).not.toContain('+1 sets');
    expect(weekSummary(p.weeks[3]!).detail).toContain('+2 sets');
  });

  it('reduces main volume in deload weeks vs hard weeks', () => {
    const p = generateProgram(profile, '2026-06-09');
    const hardMain = p.weeks[0]!.sessions[0]!.blocks.filter((b) => b.category === 'main').reduce(
      (s, b) => s + b.sets,
      0,
    );
    const deloadMain = p.weeks[2]!.sessions[0]!.blocks.filter((b) => b.category === 'main').reduce(
      (s, b) => s + b.sets,
      0,
    );
    expect(deloadMain).toBeLessThan(hardMain);
  });
});

// BC-63: a beginner (VB/V0/V1/V2) must NOT be programmed an intermediate's max-effort plan —
// no RPE-9 limit-boulder day, no 4×4 power-endurance day — both injury vectors on undeveloped
// tendons/skin/pulleys. The fix is rotation-only: a beginner's week is built from the EXISTING,
// unchanged low-intensity session types (volume-technique RPE 6 + antagonist-prehab RPE 6), so
// every beginner block is identical-to-or-absent-versus the grade-agnostic output — additive-
// safety holds under every reading (we removed the two hard days, never raised a block). This
// keeps the change out of adaptation.ts/loadMetrics.ts (no safety-reviewer needed).
describe('generateProgram — beginner-aware content (BC-63)', () => {
  const beginnerGrades = [-1, 0, 1, 2]; // VB, V0, V1, V2
  const allBlocks = (p: ReturnType<typeof generateProgram>) =>
    p.weeks.flatMap((w) => w.sessions.flatMap((s) => s.blocks));
  /** The grade-agnostic engine's peak intensity (limit day, hard phase). The whole point of
   *  BC-63 is that a beginner never reaches this. */
  const GRADE_AGNOSTIC_PEAK_RPE = 9;

  it.each(beginnerGrades)(
    'never gives a V%d-and-below climber a max-effort block (RPE never exceeds 6, strictly below the grade-agnostic peak)',
    (g) => {
      const p = generateProgram({ ...profile, currentGrade: g, goalGrade: 4 }, '2026-06-09');
      for (const b of allBlocks(p)) {
        // ≤ 6 across EVERY phase (hard, deload, peak) — and well below the RPE-9 limit work.
        expect(b.targetRPE, `block ${b.id} (grade ${g}) exceeds RPE 6`).toBeLessThanOrEqual(6);
        expect(b.targetRPE).toBeLessThan(GRADE_AGNOSTIC_PEAK_RPE);
      }
    },
  );

  it.each(beginnerGrades)(
    'never gives a V%d-and-below climber a limit-boulder or power-endurance main, at ANY frequency 1..7',
    (g) => {
      for (let n = 1; n <= 7; n++) {
        const p = generateProgram(
          { ...profile, currentGrade: g, goalGrade: 4, sessionsPerWeek: n },
          '2026-06-09',
        );
        const types = p.weeks.flatMap((w) => w.sessions.map((s) => s.type));
        expect(types, `grade ${g}, ${n}×/week`).not.toContain('limit-boulder');
        expect(types, `grade ${g}, ${n}×/week`).not.toContain('power-endurance');
        const ids = allBlocks(p).map((b) => b.id);
        expect(ids).not.toContain('main-limit');
        expect(ids).not.toContain('main-4x4');
        expect(p.weeks[0]!.sessions).toHaveLength(n); // frequency still honoured
      }
    },
  );

  it('gives a beginner a credible sub-limit stimulus every climbing day (volume-technique RPE 6, never RPE 9 limit)', () => {
    const p = generateProgram({ ...profile, currentGrade: -1, goalGrade: 4 }, '2026-06-09');
    const hardWeek = p.weeks[0]!; // PHASE_PATTERN[0] === 'hard'
    const mains = hardWeek.sessions.flatMap((s) => s.blocks.filter((b) => b.category === 'main'));
    // not an empty/placeholder plan — real moderate (RPE 6) climbing + technique work…
    expect(mains.length).toBeGreaterThan(0);
    expect(mains.some((b) => b.id === 'main-volume' && b.targetRPE === 6)).toBe(true);
    // …and capped: nothing reaches the RPE-9 limit / RPE-8 4×4 the engine gives intermediates.
    expect(mains.every((b) => b.targetRPE <= 6)).toBe(true);
  });

  it('keeps BOTH deload weeks genuinely easy for a beginner (mid-cycle and end-of-cycle, RPE ≤ 6)', () => {
    const p = generateProgram({ ...profile, currentGrade: -1, goalGrade: 4 }, '2026-06-09');
    for (const wi of [2, 5]) {
      // PHASE_PATTERN = hard,hard,deload,hard,peak,deload → indices 2 and 5 are deloads.
      expect(p.weeks[wi]!.phase).toBe('deload');
      const mains = p.weeks[wi]!.sessions.flatMap((s) =>
        s.blocks.filter((b) => b.category === 'main'),
      );
      for (const b of mains) expect(b.targetRPE).toBeLessThanOrEqual(6);
    }
  });

  it('keeps the beginner PEAK week safe too — no max-effort despite the peak label', () => {
    const p = generateProgram({ ...profile, currentGrade: 0, goalGrade: 4 }, '2026-06-09');
    const peak = p.weeks[4]!; // PHASE_PATTERN[4] === 'peak'
    expect(peak.phase).toBe('peak');
    const types = peak.sessions.map((s) => s.type);
    expect(types).not.toContain('limit-boulder');
    expect(types).not.toContain('power-endurance');
    for (const b of peak.sessions.flatMap((s) => s.blocks)) {
      expect(b.targetRPE).toBeLessThanOrEqual(6);
    }
  });

  it('still programs a V3 climber an intermediate plan (band boundary holds)', () => {
    const p = generateProgram({ ...profile, currentGrade: 3 }, '2026-06-09');
    const types = p.weeks.flatMap((w) => w.sessions.map((s) => s.type));
    expect(types).toContain('limit-boulder'); // V3 = intermediate → still gets limit work
  });

  it('leaves the intermediate (V5) program byte-identical — no regression for the original audience', () => {
    // The default profile is V5; assert the max-effort prescription the spec's v1 audience
    // depends on is untouched: a hard-week limit day at RPE 9 and a 4×4 day at RPE 8.
    const p = generateProgram(profile, '2026-06-09');
    const hard = p.weeks[0]!;
    const limit = hard.sessions
      .find((s) => s.type === 'limit-boulder')!
      .blocks.find((b) => b.id === 'main-limit')!;
    const pe = hard.sessions
      .find((s) => s.type === 'power-endurance')!
      .blocks.find((b) => b.id === 'main-4x4')!;
    expect(limit.targetRPE).toBe(9);
    expect(pe.targetRPE).toBe(8);
  });
});

const asOf = new Date('2026-06-11');

describe('detectLayoff', () => {
  it('reports no layoff and a null gap when there are no logs (new climber)', () => {
    const status = detectLayoff([], asOf);
    expect(status.daysSinceLastLog).toBeNull();
    expect(status.isLongLayoff).toBe(false);
  });

  it('measures the gap from the MOST RECENT log, not the oldest', () => {
    const logs = [mockLogOn('2026-05-12'), mockLogOn('2026-06-06')]; // 30d and 5d ago
    const status = detectLayoff(logs, asOf);
    expect(status.daysSinceLastLog).toBe(5);
    expect(status.isLongLayoff).toBe(false);
  });

  it('does NOT flag a layoff one day below the threshold', () => {
    const status = detectLayoff([mockLogOn('2026-05-29')], asOf); // 13 days
    expect(status.daysSinceLastLog).toBe(LAYOFF_GAP_DAYS - 1);
    expect(status.isLongLayoff).toBe(false);
  });

  it('flags a layoff exactly at the threshold boundary', () => {
    const status = detectLayoff([mockLogOn('2026-05-28')], asOf); // 14 days
    expect(status.daysSinceLastLog).toBe(LAYOFF_GAP_DAYS);
    expect(status.isLongLayoff).toBe(true);
  });

  it('ignores future-dated logs when finding the most recent one', () => {
    const status = detectLayoff([mockLogOn('2026-07-01')], asOf); // after asOf
    expect(status.daysSinceLastLog).toBeNull();
    expect(status.isLongLayoff).toBe(false);
  });
});

describe('reEntryReRamp', () => {
  function limitSession(): PlannedSession {
    const p = generateProgram(profile, '2026-06-09');
    const s = p.weeks[0]!.sessions.find((x) => x.type === 'limit-boulder');
    return s!;
  }

  function mainSets(s: PlannedSession): number {
    return s.blocks.filter((b) => b.category === 'main').reduce((sum, b) => sum + b.sets, 0);
  }

  it('returns null when the climber logged recently (no layoff)', () => {
    const result = reEntryReRamp(limitSession(), [mockLogOn('2026-06-08')], asOf);
    expect(result).toBeNull();
  });

  it('returns null for a brand-new climber with no logs', () => {
    const result = reEntryReRamp(limitSession(), [], asOf);
    expect(result).toBeNull();
  });

  it('halves main volume and caps intensity after a long layoff', () => {
    const planned = limitSession();
    const before = mainSets(planned);
    const result = reEntryReRamp(planned, [mockLogOn('2026-05-21')], asOf); // 21 days
    expect(result).not.toBeNull();
    expect(mainSets(result!.adjustedSession)).toBeLessThan(before);
    for (const b of result!.adjustedSession.blocks) {
      if (b.category === 'main') expect(b.targetRPE).toBeLessThanOrEqual(6);
    }
  });

  it('makes the warm-up mandatory and surfaces a clear re-ramp reason', () => {
    const result = reEntryReRamp(limitSession(), [mockLogOn('2026-05-21')], asOf); // 3 weeks
    expect(result!.warmupMandatory).toBe(true);
    expect(result!.changes).toHaveLength(1);
    expect(result!.changes[0]!.ruleId).toBe('layoff-reramp');
    expect(result!.changes[0]!.reason).toContain('3');
  });

  it('does not mutate the planned session passed in (purity)', () => {
    const planned = limitSession();
    const before = mainSets(planned);
    reEntryReRamp(planned, [mockLogOn('2026-05-21')], asOf);
    expect(mainSets(planned)).toBe(before);
  });
});
