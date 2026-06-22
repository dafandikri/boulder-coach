// BC-64 — freeform / quick logging of off-plan sessions (an extra session, a rest-day
// climb, a drop-in at another gym). The planned-session player is otherwise the only
// SessionLog writer, so off-plan load was invisible to ACWR / streak / Insights. This
// pure helper owns the validate + id-disambiguation + build-input decisions; the page
// only does the repo I/O (logic-in-covered-layers). Pure: no I/O, no React.

import type { VGrade } from '@/domain/types';
import type { SessionLogInput } from '@/domain/sessionLog';

/** The raw freeform-log form, already normalized by the page (grades expanded to a flat list). */
export interface QuickLogForm {
  date: string; // ISO yyyy-mm-dd
  durationMin: number;
  sessionRPE: number; // 1..10
  gradesSent: VGrade[];
  notes?: string;
}

const MAX_DURATION_MIN = 600; // a 10-hour cap guards against a fat-fingered entry
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** First human-readable problem with the form, or null when it's well-formed. */
export function validateQuickLog(form: QuickLogForm): string | null {
  if (!ISO_DATE.test(form.date)) {
    return 'Pick a valid date.';
  }
  if (!Number.isFinite(form.durationMin) || form.durationMin <= 0) {
    return 'Duration must be more than 0 minutes.';
  }
  if (form.durationMin > MAX_DURATION_MIN) {
    return `Duration must be ${MAX_DURATION_MIN} minutes or less.`;
  }
  if (!Number.isInteger(form.sessionRPE) || form.sessionRPE < 1 || form.sessionRPE > 10) {
    return 'Session RPE must be a whole number from 1 to 10.';
  }
  return null;
}

/**
 * A unique id for a freeform log on `date`. Deliberately NEVER returns the bare
 * `log-<date>` the planned-session player owns (so a freeform log can't overwrite,
 * or be overwritten by, the day's planned log), and increments past any existing
 * freeform ids so multiple freeform logs coexist on one local day. Pure/deterministic.
 */
export function freeformLogId(date: string, existingIds: string[]): string {
  const taken = new Set(existingIds);
  for (let n = 1; ; n++) {
    const candidate = `log-${date}-q${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Build the write input for a freeform log: no `plannedSessionId`, a unique id, and a
 * single synthetic block carrying the session so it flows through the engine unchanged
 * (sRPE × duration drives ACWR; the block's grades feed Insights' pyramid). Sends are
 * also recorded as attempts — every send is a successful attempt (BC-65 invariant).
 */
export function buildQuickLogInput(form: QuickLogForm, existingIds: string[]): SessionLogInput {
  return {
    id: freeformLogId(form.date, existingIds),
    date: form.date,
    warmupCompleted: false,
    blocks: [
      {
        blockId: 'freeform',
        setsCompleted: 1,
        gradesAttempted: [...form.gradesSent],
        gradesSent: [...form.gradesSent],
        rpe: form.sessionRPE,
      },
    ],
    sessionRPE: form.sessionRPE,
    durationMin: form.durationMin,
    notes: form.notes,
  };
}
