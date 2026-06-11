import type { BodyPart, CheckIn } from '@/domain/types';

/**
 * Check-in form prefill (BC-12).
 *
 * The check-in page used to start blank and silently OVERWRITE any entry already
 * logged for today. Instead, when a check-in exists for the local date we pre-fill
 * the form with its values (and flag `editing`) so the user edits rather than
 * clobbers. The DECISION — "is there an entry for today, and what values does it
 * seed?" — is logic, so it lives here (gate-covered) not in the page.
 */

export type CheckInFlags = Partial<Record<BodyPart, number>>;

export interface CheckInFormValues {
  sleepQuality: number;
  overallFatigue: number;
  motivation: number;
  soreness: CheckInFlags;
  pain: CheckInFlags;
  /** True when these values came from an existing entry for today (vs. blank). */
  editing: boolean;
}

/** Blank starting point for a brand-new check-in (matches the prior defaults). */
export const DEFAULT_CHECKIN_FORM = {
  sleepQuality: 4,
  overallFatigue: 2,
  motivation: 4,
} as const;

/**
 * Seed the form. With no existing entry, return blank defaults (`editing: false`).
 * With today's entry present, return its values (`editing: true`). The soreness/
 * pain maps are copied so the form's local edits never mutate the stored object.
 */
export function checkInFormValues(existing: CheckIn | undefined): CheckInFormValues {
  if (!existing) {
    return {
      sleepQuality: DEFAULT_CHECKIN_FORM.sleepQuality,
      overallFatigue: DEFAULT_CHECKIN_FORM.overallFatigue,
      motivation: DEFAULT_CHECKIN_FORM.motivation,
      soreness: {},
      pain: {},
      editing: false,
    };
  }
  return {
    sleepQuality: existing.sleepQuality,
    overallFatigue: existing.overallFatigue,
    motivation: existing.motivation,
    soreness: { ...existing.soreness },
    pain: { ...existing.pain },
    editing: true,
  };
}
