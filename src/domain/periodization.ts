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
import { getDrillsByCategory } from './drills';

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

/** BC-48: the deliberate technique drill for a volume day, rotated by week so
 *  consecutive weeks differ (absorbs BC-19). Deterministic, pure. */
function drillForWeek(weekIndex: number): { name: string; description: string } {
  const techniqueDrills = getDrillsByCategory('technique');
  const d = techniqueDrills[weekIndex % techniqueDrills.length];
  // The library guarantees ≥1 technique drill (asserted by the drills gate), so
  // the modulo always lands; fall back defensively without a dead branch.
  return d ?? { name: 'silent feet', description: 'Place each foot precisely and quietly.' };
}

/**
 * Main blocks for a session. BC-48 adds **week-to-week variation** so a phase no
 * longer repeats the same week: `phaseRunOrdinal` (how many earlier weeks share
 * this phase) drives a progressive-overload set bump, and the volume day's drill
 * rotates by `weekIndex`. Still bounded by the phase volume multiplier and the
 * VB grade floor (additive-safety preserved).
 */
function mainBlocksFor(
  type: SessionType,
  phase: PhaseKind,
  currentGrade: number,
  weekIndex: number,
  phaseRunOrdinal: number,
): Block[] {
  const vol = PHASE_VOLUME[phase];
  const round = (n: number): number => Math.max(1, Math.round(n));
  // Progressive overload: each successive week within a phase run adds a little volume.
  const overload = phaseRunOrdinal;

  switch (type) {
    case 'limit-boulder':
      return [
        {
          id: 'main-limit',
          name: 'Limit bouldering',
          category: 'main',
          grip: 'mixed',
          sets: round(6 * vol) + overload,
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
          sets: round(4 * vol) + overload,
          targetGrade: Math.max(VB, currentGrade - 1),
          targetRPE: phase === 'deload' ? 6 : 8,
          notes: '4 problems × 4 rounds at onsight grade.',
          content: mainContentFor(type),
        },
      ];
    case 'volume-technique': {
      const drill = drillForWeek(weekIndex);
      return [
        {
          id: 'main-volume',
          name: 'Volume + drill focus',
          category: 'main',
          grip: 'open-hand',
          sets: round(12 * vol) + overload,
          targetGrade: Math.max(VB, currentGrade - 2),
          targetRPE: 6,
          notes: `Moderate grades. This week's drill: ${drill.name} — ${drill.description}`,
          content: mainContentFor(type),
        },
      ];
    }
    case 'antagonist-prehab':
      return [
        {
          id: 'main-antagonist',
          name: 'Antagonist + prehab circuit',
          category: 'main',
          grip: 'open-hand',
          sets: round(3 * vol) + overload,
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
    // BC-52: the cooldown is rich too, so the player's "How to do this" appears
    // for it — the climber who doesn't know this routine gets the steps + image.
    content: {
      imageId: 'cooldown-prehab',
      dosage: '2 rounds, controlled tempo',
      steps: [
        'Rotator-cuff: light band external rotations, elbow pinned to your side.',
        'Wrist/forearm: gentle flexor and extensor stretches, then a few band curls.',
        'Finger extensors: rubber-band openings to balance all the gripping.',
        'Finish with easy breathing and any tight-area mobility.',
      ],
      cues: ['Light load', 'Slow and controlled', 'Balance the pulling you just did'],
      commonMistakes: [
        'Skipping it because the climbing is "done"',
        'Going heavy — this is maintenance, not a workout',
      ],
    },
  };
}

function buildSession(
  programId: string,
  weekIndex: number,
  dayIndex: number,
  type: SessionType,
  phase: PhaseKind,
  currentGrade: number,
  phaseRunOrdinal: number,
): PlannedSession {
  const blocks: Block[] = [
    ...generateWarmup({ injuryActive: false }),
    ...mainBlocksFor(type, phase, currentGrade, weekIndex, phaseRunOrdinal),
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
    // How many earlier weeks share this phase — drives progressive overload (BC-48).
    const phaseRunOrdinal = PHASE_PATTERN.slice(0, weekIndex).filter((p) => p === phase).length;
    const sessions = rotation.map((type, dayIndex) =>
      buildSession(
        programId,
        weekIndex,
        dayIndex,
        type,
        phase,
        profile.currentGrade,
        phaseRunOrdinal,
      ),
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

const PHASE_LABEL: Record<PhaseKind, string> = {
  hard: 'Build',
  peak: 'Peak',
  deload: 'Deload',
};

/**
 * BC-53: a *differentiating* one-line summary for a program week, so the program
 * list no longer reads identically week to week. Two weeks of the same phase get
 * different headlines because the build ordinal (progressive overload, mirroring
 * `phaseRunOrdinal`) and the rotating technique focus (`drillForWeek`) both change.
 * Pure + `asOf`-free; the page only renders the string. Derived from the canonical
 * `PHASE_PATTERN`, so it agrees with the blocks `generateProgram` actually built.
 */
export function weekHeadline(week: ProgramWeek): string {
  const ordinal = PHASE_PATTERN.slice(0, week.weekIndex).filter((p) => p === week.phase).length;
  // Within a phase run the later weeks carry +ordinal extra main sets (overload).
  const phasePart =
    week.phase === 'deload' ? PHASE_LABEL.deload : `${PHASE_LABEL[week.phase]} ${ordinal + 1}`;
  const loadCue =
    week.phase === 'deload'
      ? 'recover'
      : ordinal > 0
        ? `+${ordinal} set${ordinal > 1 ? 's' : ''}`
        : 'base volume';
  const hasVolume = week.sessions.some((s) => s.type === 'volume-technique');
  const focus = hasVolume ? ` · focus: ${drillForWeek(week.weekIndex).name}` : '';
  return `${phasePart} · ${loadCue}${focus}`;
}
