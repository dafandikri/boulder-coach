import type {
  AdaptationChange,
  AdaptationLogEntry,
  BodyPart,
  CheckIn,
  PlannedSession,
  Program,
  UserProfile,
  VGrade,
} from '@/domain/types';
import type { IClimbRepo } from '@/data/IClimbRepo';
import { generateProgram } from '@/domain/periodization';
import { VB, MAX_GRADE, formatGrade, isValidGrade } from '@/domain/grade';
import { programPosition, type ProgramPosition } from '@/domain/programClock';
import { pickDaySession } from '@/domain/schedule';
import { computeLoadMetrics } from '@/domain/loadMetrics';
import { adapt } from '@/domain/adaptation';
import { computeReadiness, type ReadinessResult } from '@/domain/readiness';
import { computeConsistency, type ConsistencyResult } from '@/domain/consistency';
import { assessBenchmark, type AssessmentResult } from '@/domain/assessment';
import { partitionLogs } from './integrity';
import { localDateIso } from './date';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_PROFILE: UserProfile = {
  currentGrade: 5, // V5, mid plateau zone
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
  injuryHistory: [], // BC-29: no prior injuries by default
};

/** A profile as entered in the onboarding/edit form — same shape as the stored
 *  UserProfile, named to make the form's intent clear at call sites. */
export type ProfileDraft = UserProfile;

const MIN_SESSIONS = 1; // BC-45: a single weekly quality session is valid …
const MAX_SESSIONS = 7; // … up to daily, with a load-management note (frequencyNotes.ts).

/** BC-29: the body parts the injury-history control offers. */
const VALID_BODY_PARTS: ReadonlySet<BodyPart> = new Set(['pip', 'wrist-tfcc', 'shoulder', 'elbow']);

/**
 * Validate a profile draft from the onboarding/edit form. Returns the first
 * human-readable problem found, or null when the draft is well-formed. Pure: the
 * form renders the message; the domain never sees an invalid profile. Checks run
 * in field order so the message names the field the user just touched.
 */
export function validateProfile(draft: ProfileDraft): string | null {
  if (!isValidGrade(draft.currentGrade)) {
    return `Current grade must be a whole V-grade between ${formatGrade(VB)} and ${formatGrade(MAX_GRADE)}.`;
  }
  if (!isValidGrade(draft.goalGrade)) {
    return `Goal grade must be a whole V-grade between ${formatGrade(VB)} and ${formatGrade(MAX_GRADE)}.`;
  }
  if (draft.goalGrade < draft.currentGrade) {
    return "Goal grade can't be below your current grade.";
  }
  if (
    !Number.isInteger(draft.sessionsPerWeek) ||
    draft.sessionsPerWeek < MIN_SESSIONS ||
    draft.sessionsPerWeek > MAX_SESSIONS
  ) {
    return `Sessions per week must be between ${MIN_SESSIONS} and ${MAX_SESSIONS}.`;
  }
  const days = draft.availableWeekdays;
  if (days.length === 0) {
    return 'Pick at least one training day.';
  }
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return 'Training days must be valid weekdays (Sun–Sat).';
  }
  if (new Set(days).size !== days.length) {
    return 'Training days must not repeat.';
  }
  if (days.length < draft.sessionsPerWeek) {
    return 'Pick at least as many training days as sessions per week.';
  }
  // BC-29: injury history is optional, but every entry must be a known body part.
  if ((draft.injuryHistory ?? []).some((p) => !VALID_BODY_PARTS.has(p))) {
    return 'Injury history contains an unknown body part.';
  }
  return null;
}

/**
 * BC-27: the profile draft after the climber accepts a measured level-up. Raises
 * `currentGrade` to the measured grade and lifts `goalGrade` to stay at or above it
 * (a goal is never lowered). Pure — the page passes the result to `applyProfile`
 * with `regenerate: true` so the next mesocycle re-anchors at the new grade.
 */
export function levelUpProfile(profile: UserProfile, measuredGrade: VGrade): ProfileDraft {
  return {
    ...profile,
    currentGrade: measuredGrade,
    goalGrade: Math.max(profile.goalGrade, measuredGrade),
  };
}

export interface ApplyProfileResult {
  /** True when the program was (re)built from this draft. */
  regenerated: boolean;
}

/**
 * Persist a profile from onboarding or an edit. On first run (no program yet) the
 * program is always generated from the draft. On a later edit it is rebuilt —
 * a fresh cycle anchored at `asOf` — ONLY when `regenerate` is true; otherwise the
 * current cycle keeps running and just the profile changes. The caller (form)
 * owns the "this replaces your current cycle" confirmation before passing true.
 */
export async function applyProfile(
  repo: IClimbRepo,
  draft: ProfileDraft,
  regenerate: boolean,
  asOf: Date = new Date(),
): Promise<ApplyProfileResult> {
  const existing = await repo.getActiveProgram();
  await repo.saveProfile(draft);
  if (!existing || regenerate) {
    await repo.saveProgram(generateProgram(draft, localDateIso(asOf)));
    return { regenerated: true };
  }
  return { regenerated: false };
}

export interface TodayResult {
  session: PlannedSession;
  changes: AdaptationChange[];
  warmupMandatory: boolean;
  /** True when no check-in existed for today, so the engine assumed neutral.
   *  Drives the "No check-in today — assuming you feel normal" banner (BC-07). */
  neutralAssumed: boolean;
  /** BC-28: today's readiness read-out. Null on a rest day, or when no real check-in
   *  exists (a neutral-assumed day shows a "check in to see readiness" prompt, never a
   *  fake green). */
  readiness: ReadinessResult | null;
  /** BC-40: this week's session progress + the consistency streak (always present). */
  consistency: ConsistencyResult;
  /** BC-27: rolling benchmark of recent sends. `leveledUp` drives the "you've leveled
   *  up — update your grade?" prompt; never lowers the grade automatically. */
  assessment: AssessmentResult;
  /** EWMA-ACWR load ratio (0 when no in-window logs). Drives the personalised ACWR
   *  explainer on Today; present on training AND rest days. */
  acwr: number;
  /** BC-32: count of stored logs quarantined as corrupt on read. >0 surfaces a
   *  "your data looks damaged — re-import a backup" recovery prompt. */
  dataIssues: number;
}

function neutralCheckIn(dateIso: string): CheckIn {
  return {
    date: dateIso,
    sleepQuality: 4,
    overallFatigue: 2,
    soreness: {},
    pain: {},
    motivation: 4,
  };
}

/**
 * Generate the next mesocycle that contains `asOf`, advancing the start date by
 * the whole cycles already elapsed. Uses the (possibly edited) profile, so a
 * fresh cycle picks up grade/frequency changes automatically.
 */
function rollToCurrentCycle(
  program: Program,
  profile: UserProfile,
  position: ProgramPosition,
): Program {
  const startMs = new Date(`${program.startDate}T00:00:00`).getTime();
  const advancedMs = startMs + position.cyclesElapsed * program.lengthWeeks * 7 * DAY_MS;
  return generateProgram(profile, localDateIso(new Date(advancedMs)));
}

export async function getTodaySession(
  repo: IClimbRepo,
  asOf: Date = new Date(),
): Promise<TodayResult> {
  let profile = await repo.getProfile();
  if (!profile) {
    profile = DEFAULT_PROFILE;
    await repo.saveProfile(profile);
  }

  let program = await repo.getActiveProgram();
  if (!program) {
    program = generateProgram(profile, localDateIso(asOf));
    await repo.saveProgram(program);
  }

  // BC-01: derive the current week from startDate + asOf. Once a mesocycle is
  // done, roll the program forward into a fresh cycle so Today never dead-ends.
  let position = programPosition(program, asOf);
  if (position.cyclesElapsed > 0) {
    program = rollToCurrentCycle(program, profile, position);
    await repo.saveProgram(program);
    position = programPosition(program, asOf);
  }

  const week = program.weeks[position.weekIndex];
  if (!week) throw new Error('program has no weeks');
  const planned = pickDaySession(week, profile.availableWeekdays, asOf);

  // BC-40: the consistency read is independent of today's prescription — compute it
  // once from the logs so it shows on training AND rest days.
  // BC-32: validate the stored logs on read — a corrupt record (truncated write,
  // partial import) is quarantined so it can't NaN the load engine; the count is
  // surfaced so the user can re-import a backup instead of hitting a silent crash.
  const { valid: logs, quarantined } = partitionLogs(await repo.getLogs());
  const dataIssues = quarantined.length;
  // BC-59: anchor the week to the PROGRAM week (program.startDate), so a new week
  // opens at 0 instead of dragging the previous week's tail forward via a rolling window.
  const consistency = computeConsistency(logs, profile, program.startDate, asOf);

  // BC-27: re-measure the baseline grade from recent sends, independent of today's
  // prescription, so the level-up prompt shows on training AND rest days.
  const assessment = assessBenchmark({ logs, currentGrade: profile.currentGrade, asOf });

  // EWMA-ACWR is independent of the prescription — compute it once so the ACWR
  // explainer can show on training AND rest days.
  const metrics = computeLoadMetrics(logs, asOf);

  // BC-03: a rest day is an explicit recovery prescription — no adaptation noise.
  if (planned.type === 'rest') {
    return {
      session: planned,
      changes: [],
      warmupMandatory: false,
      neutralAssumed: false,
      readiness: null,
      consistency,
      assessment,
      acwr: metrics.acwr,
      dataIssues,
    };
  }

  const dateIso = localDateIso(asOf);
  const storedCheckIn = await repo.getCheckIn(dateIso);
  const neutralAssumed = storedCheckIn === undefined;
  const checkIn = storedCheckIn ?? neutralCheckIn(dateIso);

  const { adjustedSession, changes, warmupMandatory } = adapt(planned, checkIn, logs, metrics);

  // BC-28: a readiness read-out from the REAL check-in only — a neutral-assumed day
  // can't honestly report readiness, so it's null (the page prompts a check-in).
  const readiness = neutralAssumed ? null : computeReadiness(checkIn, metrics);

  // BC-07: persist the "why" log idempotently per local date — re-rendering the
  // same day overwrites the entry (keyed by date) rather than duplicating it.
  await repo.saveAdaptationLogEntry({ date: dateIso, changes, neutralAssumed });

  return {
    session: adjustedSession,
    changes,
    warmupMandatory,
    neutralAssumed,
    readiness,
    consistency,
    assessment,
    acwr: metrics.acwr,
    dataIssues,
  };
}

/**
 * The persisted "why" log, newest-first (BC-07). Pure sort over a copy so the
 * Insights page can render it directly — the decision-ordering logic lives here
 * (covered), not in the gate-blind component.
 */
export function sortAdaptationLogNewestFirst(
  entries: readonly AdaptationLogEntry[],
): AdaptationLogEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

/** Load the decision log from the repo, already sorted newest-first (BC-07). */
export async function loadAdaptationLog(repo: IClimbRepo): Promise<AdaptationLogEntry[]> {
  return sortAdaptationLogNewestFirst(await repo.getAdaptationLog());
}
