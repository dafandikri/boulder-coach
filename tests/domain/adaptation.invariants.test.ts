import { describe, it, expect } from 'vitest';
import { adapt } from '../../src/domain/adaptation';
import type {
  BodyPart,
  CheckIn,
  LoadMetrics,
  LoggedBlock,
  PlannedSession,
  SessionLog,
} from '../../src/domain/types';

/**
 * EXECUTABLE SAFETY INVARIANTS — tool-neutral enforcement of the canonical
 * injury-safety rule table (docs/specs/2026-06-09-bouldering-coach-app-design.md).
 *
 * These fuzz `adapt()` across the full safety-relevant input grid and assert the
 * guarantees that MUST hold for every input. They are the Tier-1 promotion of the
 * `safety-rule-reviewer` step: any model/provider that weakens a safety rule fails
 * the gate here — no human or Claude-specific reviewer required. See
 * skills/universal-quality-bar.md.
 *
 * If you change a rule and a case below fails, do NOT relax the assertion to go
 * green — confirm against the rule table first. A red invariant is the system
 * working as designed.
 */

const PLANNED_MAIN_GRADE = 5;
const PLANNED_MAIN_SETS = 6;
const PLANNED_MAIN_RPE = 9;

function planned(): PlannedSession {
  return {
    id: 's1',
    programId: 'p',
    weekIndex: 0,
    dayIndex: 0,
    type: 'limit-boulder',
    blocks: [
      { id: 'wu', name: 'Warm-up', category: 'warmup', grip: 'open-hand', sets: 10, targetRPE: 4 },
      {
        id: 'm',
        name: 'Limit bouldering',
        category: 'main',
        grip: 'crimp',
        sets: PLANNED_MAIN_SETS,
        targetGrade: PLANNED_MAIN_GRADE,
        targetRPE: PLANNED_MAIN_RPE,
      },
      {
        id: 'cd',
        name: 'Cooldown',
        category: 'cooldown',
        grip: 'open-hand',
        sets: 2,
        targetRPE: 4,
      },
    ],
  };
}

function checkIn(over: Partial<CheckIn>): CheckIn {
  return {
    date: '2026-06-09',
    sleepQuality: 4,
    overallFatigue: 2,
    soreness: {},
    pain: {},
    motivation: 4,
    ...over,
  };
}

function logBlock(over: Partial<LoggedBlock> = {}): LoggedBlock {
  return { blockId: 'm', setsCompleted: 6, gradesAttempted: [], gradesSent: [], rpe: 7, ...over };
}

function log(date: string, block: LoggedBlock): SessionLog {
  return {
    id: `log-${date}`,
    date,
    warmupCompleted: true,
    blocks: [block],
    sessionRPE: block.rpe,
    durationMin: 60,
  };
}

const SAFETY_RULES = ['pain', 'soreness', 'acwr-high', 'acwr-caution', 'fatigue'];

const mainOf = (s: PlannedSession) => s.blocks.filter((b) => b.category === 'main');
const totalMainSets = (s: PlannedSession) => mainOf(s).reduce((n, b) => n + b.sets, 0);

// ── Input grid (safety-relevant dimensions) ────────────────────────────────
const PAINS: Partial<Record<BodyPart, number>>[] = [
  {},
  { pip: 1 },
  { pip: 3 },
  { shoulder: 2 },
  { 'wrist-tfcc': 2 },
  { elbow: 1 },
];
const SORES: Partial<Record<BodyPart, number>>[] = [{}, { pip: 2 }, { shoulder: 1 }];
const SLEEP = [1, 3, 5];
const FATIGUE = [2, 4, 5];
const ACWR = [0, 1.0, 1.3, 1.45, 1.6, 2.5];
const LOG_SCENARIOS: Record<string, SessionLog[]> = {
  none: [],
  crushing: [
    log('2026-06-08', logBlock({ gradesSent: [5, 6], rpe: 7 })),
    log('2026-06-05', logBlock({ gradesSent: [5], rpe: 8 })),
  ],
  missing: [
    log('2026-06-08', logBlock({ gradesSent: [], rpe: 9 })),
    log('2026-06-05', logBlock({ gradesSent: [4], rpe: 9 })),
  ],
};

describe('adapt — safety invariants (fuzzed over the full input grid)', () => {
  it('holds every safety guarantee for all input combinations', () => {
    let cases = 0;
    for (const pain of PAINS)
      for (const soreness of SORES)
        for (const sleepQuality of SLEEP)
          for (const overallFatigue of FATIGUE)
            for (const acwr of ACWR)
              for (const scenario of Object.keys(LOG_SCENARIOS)) {
                cases++;
                const input = planned();
                const snapshot = structuredClone(input);
                const metrics: LoadMetrics = { acute: 0, chronic: acwr === 0 ? 0 : 300, acwr };
                const ci = checkIn({ sleepQuality, overallFatigue, soreness, pain });
                const logs = LOG_SCENARIOS[scenario]!;

                const { adjustedSession, changes, warmupMandatory } = adapt(
                  input,
                  ci,
                  logs,
                  metrics,
                );
                const ctx = `pain=${JSON.stringify(pain)} sore=${JSON.stringify(soreness)} sleep=${sleepQuality} fat=${overallFatigue} acwr=${acwr} logs=${scenario}`;

                const main = mainOf(adjustedSession);
                const ruleIds = changes.map((c) => c.ruleId);
                const safetyFired = ruleIds.some((r) => SAFETY_RULES.includes(r));
                const painFlagged = Object.values(pain).some((v) => v > 0);

                // INVARIANT 1 — adapt NEVER increases main volume above the plan, ever.
                expect(totalMainSets(adjustedSession), `vol ↑ : ${ctx}`).toBeLessThanOrEqual(
                  PLANNED_MAIN_SETS,
                );

                // INVARIANT 2 — target grade never jumps more than +1 and never below V1.
                for (const b of main) {
                  if (b.targetGrade !== undefined) {
                    expect(b.targetGrade, `grade jump : ${ctx}`).toBeLessThanOrEqual(
                      PLANNED_MAIN_GRADE + 1,
                    );
                    expect(b.targetGrade, `grade <1 : ${ctx}`).toBeGreaterThanOrEqual(1);
                  }
                }

                // INVARIANT 3 — progression (load ↑) NEVER fires alongside any safety rule.
                if (safetyFired) {
                  expect(ruleIds, `progression w/ safety : ${ctx}`).not.toContain('progression');
                  expect(ruleIds, `regression w/ safety : ${ctx}`).not.toContain('regression');
                  for (const b of main) {
                    if (b.targetGrade !== undefined) {
                      expect(b.targetGrade, `grade ↑ under safety : ${ctx}`).toBeLessThanOrEqual(
                        PLANNED_MAIN_GRADE,
                      );
                    }
                  }
                }

                // INVARIANT 4 — sharp pain: warm-up mandatory, volume cut ≥50%, open-hand only.
                if (painFlagged) {
                  expect(warmupMandatory, `pain no warmup : ${ctx}`).toBe(true);
                  expect(ruleIds, `pain no change : ${ctx}`).toContain('pain');
                  expect(totalMainSets(adjustedSession), `pain vol : ${ctx}`).toBeLessThanOrEqual(
                    Math.round(PLANNED_MAIN_SETS * 0.5),
                  );
                  for (const b of main) {
                    expect(b.grip, `pain grip : ${ctx}`).toBe('open-hand');
                  }
                }

                // INVARIANT 5 — high load (ACWR>1.5) with no pain → main RPE capped ≤6.
                if (acwr > 1.5 && !painFlagged) {
                  for (const b of main)
                    expect(b.targetRPE, `acwr-high rpe : ${ctx}`).toBeLessThanOrEqual(6);
                }

                // INVARIANT 6 — caution band [1.3,1.5] with no pain → main RPE capped ≤8.
                if (acwr >= 1.3 && acwr <= 1.5 && !painFlagged) {
                  for (const b of main)
                    expect(b.targetRPE, `acwr-caution rpe : ${ctx}`).toBeLessThanOrEqual(8);
                }

                // INVARIANT 7 — purity: the planned input is never mutated.
                expect(input, `mutated input : ${ctx}`).toEqual(snapshot);

                // INVARIANT 8 — warm-up is never dropped.
                expect(
                  adjustedSession.blocks.some((b) => b.id === 'wu'),
                  `warmup dropped : ${ctx}`,
                ).toBe(true);
              }

    // guard against an accidentally-empty grid silently passing.
    expect(cases).toBeGreaterThan(1000);
  });
});
