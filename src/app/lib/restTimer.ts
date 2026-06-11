import type { SessionType } from '@/domain/types';

export type { SessionType };

/** Rest defaults for one session type. `betweenRounds` is set only for
 *  interval-based work (4×4 power-endurance) where rounds rest differs from
 *  the short rest between individual problems. */
export interface RestConfig {
  /** seconds of rest between work efforts (problems / sets) */
  betweenSets: number;
  /** seconds of rest between rounds; undefined when the session has no rounds */
  betweenRounds?: number;
}

/** Sensible defaults by session type (spec screen 3). Limit bouldering lives on
 *  full rest (~3 min); 4×4 power-endurance needs strict intervals (~1 min between
 *  problems, ~4 min between rounds). A total Record means no unreachable branch. */
const REST_DEFAULTS: Record<SessionType, RestConfig> = {
  'limit-boulder': { betweenSets: 180 },
  'power-endurance': { betweenSets: 60, betweenRounds: 240 },
  'volume-technique': { betweenSets: 60 },
  'antagonist-prehab': { betweenSets: 90 },
  rest: { betweenSets: 60 },
};

export function restConfigFor(type: SessionType): RestConfig {
  return REST_DEFAULTS[type];
}

/** Wall-clock timestamp (ms) at which a rest of `durationSec` starting now ends.
 *  Storing the END timestamp — not a tick accumulator — is what lets the timer
 *  survive a screen-lock: when the PWA wakes, remaining is recomputed from the
 *  clock, so suspended time is never lost. A negative duration clamps to now. */
export function restEndsAt(nowMs: number, durationSec: number): number {
  return nowMs + Math.max(0, durationSec) * 1000;
}

/** Whole seconds left until `endsAtMs`, rounded UP so the display never shows 0
 *  while any time remains. Never negative (a long lock can't push it below 0). */
export function restRemainingSec(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

/** True once the wall clock reaches/passes the rest's end — the cue trigger. */
export function restElapsed(endsAtMs: number, nowMs: number): boolean {
  return nowMs >= endsAtMs;
}

/** "M:SS" countdown label. Floors fractional seconds; clamps negatives to 0:00. */
export function formatRest(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
