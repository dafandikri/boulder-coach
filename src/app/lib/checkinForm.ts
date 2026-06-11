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

/** Highest severity on the spec's 1..3 scale; cycling past it clears the part. */
const MAX_SEVERITY = 3;

/**
 * Cycle a body-part's severity on tap (BC-13): none → 1 → 2 → 3 → none.
 *
 * The spec models soreness/pain severity as 1..3 (see `CheckIn` in domain/types),
 * but the check-in page used to toggle 0↔2, so the engine could never tell "a bit
 * tender" (1) from "sharp" (3). This is the DECISION behind each tap, so it lives
 * here (gate-covered) — not in the gate-blind page. Returns a NEW map; the input
 * is never mutated. At severity 3 the next tap removes the key (back to none).
 */
export function cycleSeverity(map: CheckInFlags, key: BodyPart): CheckInFlags {
  const next = (map[key] ?? 0) + 1;
  if (next > MAX_SEVERITY) {
    const { [key]: _cleared, ...rest } = map;
    return rest;
  }
  return { ...map, [key]: next };
}

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
