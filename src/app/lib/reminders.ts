import type { SessionType } from '@/domain/types';

/**
 * BC-20 — training-day reminders. Local notifications on training-day mornings:
 * "Limit day today — check in first." Depends on BC-03 (real schedule) and BC-15
 * (HTTPS origin, so the Notification API is available).
 *
 * HONEST LIMITATION: this app has no push backend (local-first, no server — see
 * docs/RUNBOOK.md). A true OS-scheduled notification at, say, 8am needs a push
 * server or the (patchily-supported) Periodic Background Sync API. So the MVP is a
 * best-effort nudge fired when the climber OPENS the app on a training-day morning
 * and hasn't been reminded today. The decision below is pure + injectable; the page
 * does the `Notification` / `localStorage` I/O.
 */

/** localStorage flag: has the user opted into reminders? */
export const REMINDER_ENABLED_KEY = 'bc-reminders-enabled';
/** localStorage key: the local-date of the last reminder, so we nudge at most once a day. */
export const REMINDER_LAST_KEY = 'bc-reminder-last-date';
/** Only nudge in the morning — a "train today" reminder at 9pm is noise, not help. */
export const MORNING_END_HOUR = 12;

/** Per-session-type reminder copy. Training days nudge a check-in first (the safety habit). */
const BODY: Record<SessionType, string> = {
  'limit-boulder': 'Limit day today 🔥 — check in first, then go hard on your projects.',
  'power-endurance': 'Power-endurance day — check in first, then bring the 4×4s.',
  'volume-technique': 'Volume & technique day — check in first, then climb smooth and plentiful.',
  'antagonist-prehab': 'Prehab day — check in first, then balance the pulls with some pushes.',
  rest: 'Rest day — recover well: sleep, hydrate, and keep it easy.',
};

export function reminderContent(type: SessionType): { title: string; body: string } {
  return { title: 'Boulder Coach', body: BODY[type] };
}

export interface RemindInput {
  /** The user has opted into reminders (REMINDER_ENABLED_KEY). */
  enabled: boolean;
  /** Current Notification permission. */
  permission: NotificationPermission;
  /** Today is a declared training day (session type !== 'rest'). */
  isTrainingDay: boolean;
  /** Local hour of day, 0–23. */
  hour: number;
  /** Local-date of the last reminder shown, or null if never. */
  lastRemindedIso: string | null;
  /** Today's local-date key. */
  todayIso: string;
}

/**
 * Decide whether to fire the open-the-app nudge. Fires only when the user opted in,
 * granted permission, it's a training-day morning, and we haven't already nudged today.
 */
export function shouldRemindOnOpen(i: RemindInput): boolean {
  if (!i.enabled) return false;
  if (i.permission !== 'granted') return false;
  if (!i.isTrainingDay) return false;
  if (i.hour >= MORNING_END_HOUR) return false;
  if (i.lastRemindedIso === i.todayIso) return false;
  return true;
}
