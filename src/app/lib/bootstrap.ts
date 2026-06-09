import type { AdaptationChange, CheckIn, PlannedSession, UserProfile } from '@/domain/types';
import type { IClimbRepo } from '@/data/IClimbRepo';
import { generateProgram } from '@/domain/periodization';
import { computeLoadMetrics } from '@/domain/loadMetrics';
import { adapt } from '@/domain/adaptation';

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

/** Day index into the current week's session rotation. */
function pickPlannedSession(sessions: PlannedSession[], asOf: Date): PlannedSession {
  const idx = asOf.getDay() % sessions.length;
  const picked = sessions[idx];
  if (!picked) throw new Error('program week has no sessions');
  return picked;
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
    program = generateProgram(profile, asOf.toISOString().slice(0, 10));
    await repo.saveProgram(program);
  }

  const week = program.weeks[program.currentWeekIndex] ?? program.weeks[0];
  if (!week) throw new Error('program has no weeks');
  const planned = pickPlannedSession(week.sessions, asOf);

  const dateIso = asOf.toISOString().slice(0, 10);
  const checkIn = (await repo.getCheckIn(dateIso)) ?? neutralCheckIn(dateIso);
  const logs = await repo.getLogs();
  const metrics = computeLoadMetrics(logs, asOf);

  const { adjustedSession, changes, warmupMandatory } = adapt(planned, checkIn, logs, metrics);

  return { session: adjustedSession, changes, warmupMandatory };
}
