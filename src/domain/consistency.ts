// BC-40 — training consistency for the Today screen: progress this week + a streak
// of consecutive weeks hitting the climber's session target. Consistency is the
// strongest predictor of progress, so surfacing it (supportively, never guilt-trippy)
// reinforces the core behaviour. Pure: no I/O, no React, `asOf`-driven.

import type { SessionLog, UserProfile } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ConsistencyResult {
  /** Sessions logged in the current rolling 7-day window. */
  weekDoneCount: number;
  /** The climber's weekly session target (`profile.sessionsPerWeek`). */
  weekTarget: number;
  /** Consecutive weeks meeting target — the current week counts only once it does,
   *  so an in-progress week never inflates *or* breaks the streak. */
  currentStreakWeeks: number;
}

/** Local midnight (ms) for a Date — strips the time so day windows are TZ-stable. */
function localDayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight (ms) for an ISO date string (date portion only). Parsing the
 *  date with an explicit `T00:00:00` makes it local (not UTC), matching `localDayStart`. */
function isoDayStart(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
}

export function computeConsistency(
  logs: SessionLog[],
  profile: UserProfile,
  asOf: Date,
): ConsistencyResult {
  const weekTarget = profile.sessionsPerWeek;
  const asOfStart = localDayStart(asOf);
  const logDays = logs.map((l) => isoDayStart(l.date));

  // Sessions whose local date falls in week `offset` back from asOf (offset 0 = the
  // 7 days ending today). Future-dated logs fall outside every window and are ignored.
  const countInWeek = (offset: number): number => {
    const hi = asOfStart - offset * 7 * DAY_MS;
    const lo = hi - 6 * DAY_MS;
    let n = 0;
    for (const t of logDays) {
      if (t >= lo && t <= hi) n++;
    }
    return n;
  };

  const weekDoneCount = countInWeek(0);

  // The current week joins the streak only when it has already met target; either way
  // it never breaks it (the week isn't over). Then walk back over completed weeks.
  let currentStreakWeeks = weekDoneCount >= weekTarget ? 1 : 0;
  for (let offset = 1; countInWeek(offset) >= weekTarget; offset++) {
    currentStreakWeeks++;
  }

  return { weekDoneCount, weekTarget, currentStreakWeeks };
}
