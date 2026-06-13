// BC-34 — the pure decision behind the Today "back up your data" nudge. All
// training history lives in evictable IndexedDB (BC-10 named this the data-loss
// risk); export exists but nothing reminds the user to use it. This rule fires a
// nudge when there is meaningful un-backed-up data — either enough new sessions
// have accrued or it has been too long since the last export — and never nags when
// nothing has changed or on a brand-new user's first paint. Pure + asOf-driven so
// the threshold boundaries are testable; the page owns only the localStorage I/O.

const DAY_MS = 24 * 60 * 60 * 1000;

/** New sessions since last export that warrant a nudge regardless of elapsed time. */
export const NUDGE_AFTER_SESSIONS = 10;
/** Days since last export that warrant a nudge once any new data exists. */
export const NUDGE_AFTER_DAYS = 30;
/** How long a "remind me later" dismissal silences the nudge. */
export const SNOOZE_DAYS = 7;

/** localStorage key for the ISO timestamp of the user's last successful export. */
export const LAST_EXPORT_KEY = 'bc:lastExportAt';
/** localStorage key for the ISO timestamp the nudge is snoozed until (dismissal). */
export const NUDGE_SNOOZE_KEY = 'bc:backupNudgeSnoozeUntil';

/**
 * Count session logs recorded strictly after `since` (the last-export timestamp).
 * `null` or an unparseable timestamp means "no usable baseline" → every log counts,
 * so a never-exported user is measured against their full history.
 */
export function countSessionsSince(logDates: string[], since: string | null): number {
  const cutoff = since === null ? NaN : new Date(since).getTime();
  if (Number.isNaN(cutoff)) return logDates.length;
  return logDates.filter((d) => new Date(d).getTime() > cutoff).length;
}

/**
 * Decide whether to surface the backup nudge. Quiet when nothing new has been
 * logged; fires once enough new sessions exist, or (for a prior export) once it is
 * older than `NUDGE_AFTER_DAYS`. A never-exported user with only a little data waits
 * for the session threshold rather than being nagged with no time baseline.
 */
export function shouldNudgeBackup(
  lastExportAt: string | null,
  asOf: Date,
  sessionsSinceExport: number,
): boolean {
  if (sessionsSinceExport <= 0) return false;
  if (sessionsSinceExport >= NUDGE_AFTER_SESSIONS) return true;
  if (lastExportAt === null) return false;
  const since = new Date(lastExportAt).getTime();
  if (Number.isNaN(since)) return false;
  return (asOf.getTime() - since) / DAY_MS >= NUDGE_AFTER_DAYS;
}

/** True while a "remind me later" dismissal is still in effect. Fails open: a
 *  missing or unparseable snooze shows the nudge rather than hiding it forever. */
export function isSnoozed(snoozeUntil: string | null, asOf: Date): boolean {
  if (snoozeUntil === null) return false;
  const until = new Date(snoozeUntil).getTime();
  if (Number.isNaN(until)) return false;
  return asOf.getTime() < until;
}

/** The ISO timestamp a dismissal should snooze the nudge until (`asOf + SNOOZE_DAYS`). */
export function snoozeUntilIso(asOf: Date): string {
  return new Date(asOf.getTime() + SNOOZE_DAYS * DAY_MS).toISOString();
}
