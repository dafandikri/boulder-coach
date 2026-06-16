// BC-40 — training consistency for the Today screen: progress this week + a streak
// of consecutive weeks hitting the climber's session target. Consistency is the
// strongest predictor of progress, so surfacing it (supportively, never guilt-trippy)
// reinforces the core behaviour. Pure: no I/O, no React, `asOf`-driven.
//
// BC-59 — weeks are anchored to the PROGRAM week, not a rolling 7-day window. A week
// is `floor((day − startDate) / 7)`, the exact bucket `programPosition` derives from
// `daysSinceStart / 7`. The rolling window never reset on a week boundary, so the tail
// of a completed week leaked into the next one (a new week opened at 2/3 instead of 0/3,
// and the streak inherited the drift). Anchoring to the program week makes a week
// boundary == a program-week boundary.

import type { SessionLog, UserProfile } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface ConsistencyResult {
  /** Sessions logged in the current PROGRAM week (resets on the week boundary). */
  weekDoneCount: number;
  /** The climber's weekly session target (`profile.sessionsPerWeek`). */
  weekTarget: number;
  /** Consecutive program weeks meeting target — the current week counts only once it
   *  does, so an in-progress week never inflates *or* breaks the streak. */
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
  /** The program's `startDate` (ISO) — the anchor every program week counts from. */
  startDate: string,
  asOf: Date,
): ConsistencyResult {
  const weekTarget = profile.sessionsPerWeek;
  const startMs = isoDayStart(startDate);
  const asOfStart = localDayStart(asOf);

  // The program week (0-based) a given local-midnight day falls in. Days before the
  // program started are negative and never match a counted week.
  const weekOf = (dayMs: number): number => Math.floor((dayMs - startMs) / WEEK_MS);
  const currentWeek = weekOf(asOfStart);

  // Only sessions up to and including today count — future-dated logs are ignored.
  const logWeeks = logs.map((l) => weekOf(isoDayStart(l.date))).filter((w) => w <= currentWeek);
  const countInWeek = (week: number): number => logWeeks.filter((w) => w === week).length;

  const weekDoneCount = countInWeek(currentWeek);

  // The current week joins the streak only when it has already met target; either way
  // it never breaks it (the week isn't over). Then walk back over completed program
  // weeks down to week 0 (the program start) — the loop is bounded by `week >= 0`, so
  // it always terminates regardless of a degenerate target ≤ 0.
  let currentStreakWeeks = weekDoneCount >= weekTarget ? 1 : 0;
  for (let week = currentWeek - 1; week >= 0 && countInWeek(week) >= weekTarget; week--) {
    currentStreakWeeks++;
  }

  return { weekDoneCount, weekTarget, currentStreakWeeks };
}
