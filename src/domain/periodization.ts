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

/** Session rotation by how many sessions the climber does per week. */
function sessionPlanFor(sessionsPerWeek: number): SessionType[] {
  switch (sessionsPerWeek) {
    case 2:
      return ['limit-boulder', 'power-endurance'];
    case 4:
      return ['limit-boulder', 'power-endurance', 'volume-technique', 'antagonist-prehab'];
    case 3:
    default:
      return ['limit-boulder', 'power-endurance', 'volume-technique'];
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
          targetGrade: Math.max(1, currentGrade - 1),
          targetRPE: phase === 'deload' ? 6 : 8,
          notes: '4 problems × 4 rounds at onsight grade.',
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
          targetGrade: Math.max(1, currentGrade - 2),
          targetRPE: 6,
          notes: 'Moderate grades, one deliberate drill (e.g. silent feet).',
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
