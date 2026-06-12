import type {
  AdaptationChange,
  AdaptationResult,
  Block,
  PhaseKind,
  PlannedSession,
  Program,
  ProgramWeek,
  SessionLog,
  SessionType,
  UserProfile,
} from './types';
import { generateWarmup } from './warmup';
import { VB } from './grade';
import type { ExerciseContent } from './exerciseContent';

export const PHASE_PATTERN: PhaseKind[] = ['hard', 'hard', 'deload', 'hard', 'peak', 'deload'];

/** Days of inactivity that count as a long layoff and trigger a deloaded re-entry. */
export const LAYOFF_GAP_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LayoffStatus {
  /** Whole days since the most recent (non-future) log, or null if none exists. */
  daysSinceLastLog: number | null;
  /** True when the gap is long enough to need a conservative re-entry ramp. */
  isLongLayoff: boolean;
}

/**
 * Detect a training gap from the most recent log as of `asOf`. A brand-new
 * climber (no logs) is NOT a layoff — they have nothing to re-ramp from.
 * Future-dated logs are ignored, mirroring how loadMetrics ages logs.
 */
export function detectLayoff(logs: SessionLog[], asOf: Date): LayoffStatus {
  let mostRecent = Number.NEGATIVE_INFINITY;
  for (const l of logs) {
    const t = new Date(l.date).getTime();
    if (t <= asOf.getTime() && t > mostRecent) mostRecent = t;
  }
  if (mostRecent === Number.NEGATIVE_INFINITY) {
    return { daysSinceLastLog: null, isLongLayoff: false };
  }
  const days = Math.floor((asOf.getTime() - mostRecent) / DAY_MS);
  return { daysSinceLastLog: days, isLongLayoff: days >= LAYOFF_GAP_DAYS };
}

/**
 * After a long layoff, force a conservative re-entry: halve main volume, cap
 * intensity at RPE 6, and make the warm-up mandatory. Returns null (no change)
 * when there is no qualifying gap. The input session is never mutated.
 */
export function reEntryReRamp(
  planned: PlannedSession,
  logs: SessionLog[],
  asOf: Date,
): AdaptationResult | null {
  const status = detectLayoff(logs, asOf);
  if (status.daysSinceLastLog === null || !status.isLongLayoff) return null;

  const session: PlannedSession = { ...planned, blocks: planned.blocks.map((b) => ({ ...b })) };
  for (const b of session.blocks) {
    if (b.category === 'main') {
      b.sets = Math.max(1, Math.round(b.sets * 0.5));
      b.targetRPE = Math.min(b.targetRPE, 6);
    }
  }

  const weeks = Math.floor(status.daysSinceLastLog / 7);
  const change: AdaptationChange = {
    ruleId: 'layoff-reramp',
    reason: `Welcome back — ${weeks}+ weeks off. Re-entry session: volume halved and intensity capped at RPE 6 to rebuild tendons and skin before pushing again.`,
  };
  return { adjustedSession: session, changes: [change], warmupMandatory: true };
}

/** Volume multiplier applied to main work by phase. */
const PHASE_VOLUME: Record<PhaseKind, number> = {
  hard: 1,
  peak: 0.85,
  deload: 0.5,
};

/**
 * Session rotation by weekly frequency (BC-45: 1..7). Additive-safety contract: the
 * week has at most ONE limit day and ONE power-endurance day; every extra session is
 * low-intensity volume/technique or antagonist-prehab, never more max-effort climbing.
 * So raising frequency adds easy volume, never injury-risking intensity.
 */
function sessionPlanFor(sessionsPerWeek: number): SessionType[] {
  const base: SessionType[] = [
    'limit-boulder',
    'power-endurance',
    'volume-technique',
    'antagonist-prehab',
  ];
  const n = Math.max(1, Math.min(7, Math.trunc(sessionsPerWeek)));
  const plan = base.slice(0, Math.min(n, base.length));
  // Days 5+ alternate volume/technique and antagonist-prehab — low-intensity fillers.
  for (let i = base.length; i < n; i++) {
    plan.push((i - base.length) % 2 === 0 ? 'volume-technique' : 'antagonist-prehab');
  }
  return plan;
}

/** BC-47: cited how-to per main session type, shown in the session player so a
 *  climber who's never run a 4×4 can execute it from the screen. (Sources in
 *  docs/research/2026-06-13-indoor-bouldering-program-best-practices.md §3.) */
function mainContentFor(type: SessionType): ExerciseContent {
  switch (type) {
    case 'limit-boulder':
      return {
        imageId: 'limit-boulder',
        steps: [
          'Warm up fully first — fatigue has no place in limit work.',
          'Pick a problem of 3–5 moves at your absolute limit.',
          'Give a focused attempt, then rest 3–5 minutes (shoes off) before the next go.',
          'Stop the problem the moment form breaks down; switch to another at the same level.',
        ],
        cues: ['Max effort, full recovery', 'Quality over quantity', 'Stop on form breakdown'],
        commonMistakes: [
          'Short-resting between attempts (turns it into endurance)',
          'Grinding a problem past form breakdown',
          'Too much total volume — keep it low',
        ],
      };
    case 'power-endurance':
      return {
        imageId: 'power-endurance-4x4',
        dosage: '4 boulders × 4 rounds, 4 min rest between rounds',
        steps: [
          'Pick 4 boulders a touch below your flash grade.',
          'Climb all 4 back-to-back with no rest — that is one round.',
          'Rest 4 minutes, then repeat for 4 total rounds.',
          'Rounds 3–4 should feel very pumped, but you should not be repeatedly falling.',
        ],
        cues: ['Back-to-back, no rest within a round', 'Pick the right grade', 'Keep moving'],
        commonMistakes: [
          'Choosing boulders too hard so you fall mid-round',
          'Resting between problems within a round',
          'Skipping the full warm-up before starting',
        ],
      };
    case 'volume-technique':
      return {
        imageId: 'volume-technique',
        steps: [
          'Pick 10–20 boulders 3–4 grades below your flash level.',
          'Choose 1–2 technique intentions for the session (e.g. silent feet, heel hooks).',
          'Climb with those intentions front of mind, resting generously.',
          'Keep it clean — the goal is skill, not fatigue.',
        ],
        cues: ['Lots of easy mileage', 'One or two focuses', "Don't build fatigue"],
        commonMistakes: [
          'Climbing too hard so technique falls apart',
          'No clear intention — just mindless laps',
          'Pumping out (this is a skill day, not endurance)',
        ],
      };
    case 'antagonist-prehab':
      return {
        imageId: 'antagonist-prehab',
        steps: [
          'Push work to balance pulling: push-ups or band overhead press.',
          'Wrist/TFCC: ECU pronation with a light band.',
          'Finger-extensor band work + rotator-cuff and scapular control.',
          'Keep it light and controlled — this is balance work, not a max effort.',
        ],
        cues: ['Controlled tempo', 'Full range', 'Light load'],
        commonMistakes: [
          'Going heavy and turning prehab into a hard workout',
          'Rushing the reps',
          'Skipping it because it is not climbing',
        ],
      };
    default:
      return { steps: [], cues: [], commonMistakes: [] };
  }
}

function mainBlocksFor(type: SessionType, phase: PhaseKind, currentGrade: number): Block[] {
  const vol = PHASE_VOLUME[phase];
  const round = (n: number): number => Math.max(1, Math.round(n));

  switch (type) {
    case 'limit-boulder':
      return [
        {
          id: 'main-limit',
          name: 'Limit bouldering',
          category: 'main',
          grip: 'mixed',
          sets: round(6 * vol),
          targetGrade: currentGrade + (phase === 'peak' ? 1 : 0),
          targetRPE: phase === 'deload' ? 6 : 9,
          notes: 'Few hard moves, long rest. Stop on form breakdown.',
          content: mainContentFor(type),
        },
      ];
    case 'power-endurance':
      return [
        {
          id: 'main-4x4',
          name: '4×4 power-endurance',
          category: 'main',
          grip: 'mixed',
          sets: round(4 * vol),
          targetGrade: Math.max(VB, currentGrade - 1),
          targetRPE: phase === 'deload' ? 6 : 8,
          notes: '4 problems × 4 rounds at onsight grade.',
          content: mainContentFor(type),
        },
      ];
    case 'volume-technique':
      return [
        {
          id: 'main-volume',
          name: 'Volume + drill focus',
          category: 'main',
          grip: 'open-hand',
          sets: round(12 * vol),
          targetGrade: Math.max(VB, currentGrade - 2),
          targetRPE: 6,
          notes: 'Moderate grades, one deliberate drill (e.g. silent feet).',
          content: mainContentFor(type),
        },
      ];
    case 'antagonist-prehab':
      return [
        {
          id: 'main-antagonist',
          name: 'Antagonist + prehab circuit',
          category: 'main',
          grip: 'open-hand',
          sets: round(3 * vol),
          targetRPE: 6,
          notes: 'Shoulder, wrist/TFCC (ECU), finger-extensor band work.',
          content: mainContentFor(type),
        },
      ];
    default:
      return [];
  }
}

function cooldownPrehab(): Block {
  return {
    id: 'cooldown-prehab',
    name: 'Cooldown prehab',
    category: 'cooldown',
    grip: 'open-hand',
    sets: 2,
    targetRPE: 4,
    notes: 'Rotator-cuff + wrist + finger-extensor maintenance.',
  };
}

function buildSession(
  programId: string,
  weekIndex: number,
  dayIndex: number,
  type: SessionType,
  phase: PhaseKind,
  currentGrade: number,
): PlannedSession {
  const blocks: Block[] = [
    ...generateWarmup({ injuryActive: false }),
    ...mainBlocksFor(type, phase, currentGrade),
    cooldownPrehab(),
  ];
  return {
    id: `${programId}-w${weekIndex}-d${dayIndex}`,
    programId,
    weekIndex,
    dayIndex,
    type,
    blocks,
  };
}

export function generateProgram(profile: UserProfile, startDate: string): Program {
  const programId = `prog-${startDate}`;
  const rotation = sessionPlanFor(profile.sessionsPerWeek);

  const weeks: ProgramWeek[] = PHASE_PATTERN.map((phase, weekIndex) => {
    const sessions = rotation.map((type, dayIndex) =>
      buildSession(programId, weekIndex, dayIndex, type, phase, profile.currentGrade),
    );
    return { weekIndex, phase, sessions };
  });

  return {
    id: programId,
    startDate,
    lengthWeeks: 6,
    weeks,
  };
}
