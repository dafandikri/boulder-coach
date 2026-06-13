import { describe, it, expect } from 'vitest';
import {
  shouldNudgeBackup,
  countSessionsSince,
  isSnoozed,
  snoozeUntilIso,
  NUDGE_AFTER_SESSIONS,
  NUDGE_AFTER_DAYS,
  SNOOZE_DAYS,
} from '../../src/app/lib/backupReminder';

// BC-34 — a pure, asOf-driven decision for the Today "back up your data" nudge.
// Evictable IndexedDB + a human who never exports = silent data loss; this rule
// turns export from a feature nobody finds into a timely habit.
const asOf = new Date('2026-06-13T12:00:00Z');
function daysAgo(n: number): string {
  return new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe('shouldNudgeBackup (BC-34)', () => {
  it('never nudges when nothing new has been logged since the last export', () => {
    expect(shouldNudgeBackup(daysAgo(90), asOf, 0)).toBe(false);
  });

  it('nudges once enough new sessions have accrued, regardless of export date', () => {
    expect(shouldNudgeBackup(daysAgo(1), asOf, NUDGE_AFTER_SESSIONS)).toBe(true);
  });

  it('nudges when the last export is older than the day threshold and data has changed', () => {
    expect(shouldNudgeBackup(daysAgo(NUDGE_AFTER_DAYS + 1), asOf, 1)).toBe(true);
  });

  it('stays quiet for a recent export with only a few new sessions', () => {
    expect(shouldNudgeBackup(daysAgo(5), asOf, 2)).toBe(false);
  });

  it('never-exported with a few sessions waits for the session threshold (no first-paint nag)', () => {
    expect(shouldNudgeBackup(null, asOf, 3)).toBe(false);
  });

  it('never-exported nudges once the session threshold is reached', () => {
    expect(shouldNudgeBackup(null, asOf, NUDGE_AFTER_SESSIONS)).toBe(true);
  });

  it('treats an unparseable lastExportAt as no usable date (session-bar only)', () => {
    expect(shouldNudgeBackup('not-a-date', asOf, 2)).toBe(false);
    expect(shouldNudgeBackup('not-a-date', asOf, NUDGE_AFTER_SESSIONS)).toBe(true);
  });
});

describe('countSessionsSince (BC-34)', () => {
  it('counts every log when there is no prior export', () => {
    expect(countSessionsSince(['2026-06-01', '2026-06-10', '2026-06-12'], null)).toBe(3);
  });

  it('counts only logs strictly after the last export timestamp', () => {
    const since = '2026-06-10T00:00:00Z';
    expect(countSessionsSince(['2026-06-09', '2026-06-11', '2026-06-12'], since)).toBe(2);
  });

  it('counts every log when the export timestamp is unparseable', () => {
    expect(countSessionsSince(['2026-06-09', '2026-06-11'], 'garbage')).toBe(2);
  });
});

describe('isSnoozed / snoozeUntilIso (BC-34 dismissal)', () => {
  it('is not snoozed when no dismissal has been recorded', () => {
    expect(isSnoozed(null, asOf)).toBe(false);
  });

  it('is snoozed until the dismissal window passes, then re-surfaces', () => {
    const until = snoozeUntilIso(asOf); // asOf + SNOOZE_DAYS
    expect(isSnoozed(until, asOf)).toBe(true);
    const afterWindow = new Date(asOf.getTime() + (SNOOZE_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isSnoozed(until, afterWindow)).toBe(false);
  });

  it('ignores an unparseable snooze timestamp (fails open — shows the nudge)', () => {
    expect(isSnoozed('garbage', asOf)).toBe(false);
  });
});
