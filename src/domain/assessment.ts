import type { SessionLog, VGrade } from './types';

// BC-27 — recalibrate the climber's baseline grade from recent sends. `currentGrade`
// is set once at onboarding (BC-06) and never re-measured; progression rule 6 bumps a
// session's target but the anchor the whole program scales from stays frozen. This
// pure rule treats recent logs as a rolling benchmark: the highest grade SENT in at
// least `SESSIONS_TO_CONFIRM` distinct sessions within `LOOKBACK_DAYS` is the measured
// grade. It only ever flags a level-UP — a regression is a coach conversation, not a
// silent demotion, so the measure never auto-lowers `currentGrade`. asOf-driven, no I/O.

const DAY_MS = 24 * 60 * 60 * 1000;

/** A grade must be sent in this many distinct sessions before it counts as "owned"
 *  — one lucky send isn't a new baseline. */
export const SESSIONS_TO_CONFIRM = 2;

/** Only sends within this window count — a benchmark reflects current form, roughly
 *  one mesocycle, not a personal best from months ago. */
export const LOOKBACK_DAYS = 42;

export interface AssessmentInput {
  logs: readonly SessionLog[];
  currentGrade: VGrade;
  asOf: Date;
}

export interface AssessmentResult {
  /** Highest grade confirmed by the logs, or null when nothing clears the bar. */
  measuredGrade: VGrade | null;
  /** True only when the measured grade is strictly above `currentGrade` — the
   *  signal that drives the "you've leveled up — update?" prompt. Never true for a
   *  measured grade at or below current (no auto-demotion). */
  leveledUp: boolean;
}

/**
 * Derive the measured baseline grade from recent send history. A grade is counted
 * once per session (multiple blocks sending it in one session is still one session),
 * within the recent window; the highest grade reaching `SESSIONS_TO_CONFIRM` sessions
 * wins. Cold start or sparse data yields `measuredGrade: null` — never NaN.
 */
export function assessBenchmark(input: AssessmentInput): AssessmentResult {
  const { logs, currentGrade, asOf } = input;
  const nowMs = asOf.getTime();
  const cutoffMs = nowMs - LOOKBACK_DAYS * DAY_MS;

  // Distinct sessions that sent each grade, restricted to the recent window.
  const sessionsByGrade = new Map<VGrade, number>();
  for (const log of logs) {
    const t = new Date(log.date).getTime();
    if (Number.isNaN(t) || t < cutoffMs || t > nowMs) continue;
    const sentThisSession = new Set<VGrade>();
    for (const block of log.blocks) {
      for (const g of block.gradesSent) sentThisSession.add(g);
    }
    for (const g of sentThisSession) {
      sessionsByGrade.set(g, (sessionsByGrade.get(g) ?? 0) + 1);
    }
  }

  let measuredGrade: VGrade | null = null;
  for (const [grade, count] of sessionsByGrade) {
    if (count >= SESSIONS_TO_CONFIRM && (measuredGrade === null || grade > measuredGrade)) {
      measuredGrade = grade;
    }
  }

  return {
    measuredGrade,
    leveledUp: measuredGrade !== null && measuredGrade > currentGrade,
  };
}
