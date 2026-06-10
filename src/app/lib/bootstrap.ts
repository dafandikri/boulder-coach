import type {
  AdaptationChange,
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

export interface TodayResult {
  session: PlannedSession;
  changes: AdaptationChange[];
  warmupMandatory: boolean;
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
    return { session: planned, changes: [], warmupMandatory: false };
  }

  const dateIso = localDateIso(asOf);
  const checkIn = (await repo.getCheckIn(dateIso)) ?? neutralCheckIn(dateIso);
  const logs = await repo.getLogs();
  const metrics = computeLoadMetrics(logs, asOf);

  const { adjustedSession, changes, warmupMandatory } = adapt(planned, checkIn, logs, metrics);

  return { session: adjustedSession, changes, warmupMandatory };
}
