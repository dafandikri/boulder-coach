import type { Block, PlannedSession, ProgramWeek } from './types';

/** Active-recovery prescription for a non-training day — never a blank screen (BC-03). */
function recoveryBlock(): Block {
  return {
    id: 'rest-recovery',
    name: 'Active recovery',
    category: 'cooldown',
    grip: 'open-hand',
    sets: 1,
    targetRPE: 2,
    notes: 'Rest day — light mobility, antagonist/prehab, sleep. No climbing load.',
  };
}

function restSession(week: ProgramWeek, programId: string): PlannedSession {
  return {
    id: `${programId}-w${week.weekIndex}-rest`,
    programId,
    weekIndex: week.weekIndex,
    dayIndex: -1,
    type: 'rest',
    blocks: [recoveryBlock()],
  };
}

/**
 * Picks today's prescription: a training session when `asOf`'s weekday is one of
 * the profile's `availableWeekdays`, otherwise an explicit rest day (BC-03).
 *
 * Available weekdays map to the week's session rotation in ascending order
 * (e.g. Mon→session 0, Wed→session 1, Fri→session 2). `getDay()` is the LOCAL
 * weekday, consistent with the local-date keys from `localDateIso` (BC-02).
 */
export function pickDaySession(
  week: ProgramWeek,
  availableWeekdays: number[],
  asOf: Date,
): PlannedSession {
  const programId = week.sessions[0]?.programId ?? `prog-w${week.weekIndex}`;
  const trainingDays = [...availableWeekdays].sort((a, b) => a - b);
  const slot = trainingDays.indexOf(asOf.getDay());

  // Not a declared training day, or a training day with no planned session
  // (more weekdays than session types) → an explicit rest day. No `% length`
  // wrap: we never fabricate a repeat session the program didn't schedule.
  const picked = slot === -1 ? undefined : week.sessions[slot];
  return picked ?? restSession(week, programId);
}
