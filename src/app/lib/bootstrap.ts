import type {
  AdaptationChange,
  AdaptationLogEntry,
  CheckIn,
  PlannedSession,
  Program,
  UserProfile,
} from '@/domain/types';
import type { IClimbRepo } from '@/data/IClimbRepo';
import { generateProgram } from '@/domain/periodization';
import { programPosition, type ProgramPosition } from '@/domain/programClock';
import { pickDaySession } from '@/domain/schedule';
import { computeLoadMetrics } from '@/domain/loadMetrics';
import { adapt } from '@/domain/adaptation';
import { localDateIso } from './date';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_PROFILE: UserProfile = {
  currentGrade: 5, // V5, mid plateau zone
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

/** A profile as entered in the onboarding/edit form — same shape as the stored
 *  UserProfile, named to make the form's intent clear at call sites. */
export type ProfileDraft = UserProfile;

const MIN_GRADE = 1;
const MAX_GRADE = 17; // V-scale ceiling
const MIN_SESSIONS = 2;
const MAX_SESSIONS = 4;

function isWholeGrade(g: number): boolean {
  return Number.isInteger(g) && g >= MIN_GRADE && g <= MAX_GRADE;
}

/**
 * Validate a profile draft from the onboarding/edit form. Returns the first
 * human-readable problem found, or null when the draft is well-formed. Pure: the
 * form renders the message; the domain never sees an invalid profile. Checks run
 * in field order so the message names the field the user just touched.
 */
export function validateProfile(draft: ProfileDraft): string | null {
  if (!isWholeGrade(draft.currentGrade)) {
    return `Current grade must be a whole V-grade between V${MIN_GRADE} and V${MAX_GRADE}.`;
  }
  if (!isWholeGrade(draft.goalGrade)) {
    return `Goal grade must be a whole V-grade between V${MIN_GRADE} and V${MAX_GRADE}.`;
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
  return null;
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

  // BC-03: a rest day is an explicit recovery prescription — no adaptation noise.
  if (planned.type === 'rest') {
    return { session: planned, changes: [], warmupMandatory: false, neutralAssumed: false };
  }

  const dateIso = localDateIso(asOf);
  const storedCheckIn = await repo.getCheckIn(dateIso);
  const neutralAssumed = storedCheckIn === undefined;
  const checkIn = storedCheckIn ?? neutralCheckIn(dateIso);
  const logs = await repo.getLogs();
  const metrics = computeLoadMetrics(logs, asOf);

  const { adjustedSession, changes, warmupMandatory } = adapt(planned, checkIn, logs, metrics);

  // BC-07: persist the "why" log idempotently per local date — re-rendering the
  // same day overwrites the entry (keyed by date) rather than duplicating it.
  await repo.saveAdaptationLogEntry({ date: dateIso, changes, neutralAssumed });

  return { session: adjustedSession, changes, warmupMandatory, neutralAssumed };
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
