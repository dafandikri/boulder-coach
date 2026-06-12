// BC-45 — training frequency can be 1..7 sessions/week. Pure guidance per frequency:
// low frequencies get encouragement, high frequencies an explicit load-management
// caution. This is advice text only — it never changes prescribed load (the rotation
// in periodization.ts keeps extra sessions low-intensity).

export interface FrequencyGuidance {
  /** True when the frequency is demanding enough to warrant a load-management warning. */
  caution: boolean;
  text: string;
}

/** Advice for a given weekly session count (clamped-agnostic: callers validate the range). */
export function frequencyGuidance(sessionsPerWeek: number): FrequencyGuidance {
  if (sessionsPerWeek <= 1) {
    return {
      caution: false,
      text: 'One session a week — make it your quality limit day. Consistency beats volume.',
    };
  }
  if (sessionsPerWeek <= 4) {
    return {
      caution: false,
      text: 'A balanced week: one hard day, the rest supporting volume, technique and prehab.',
    };
  }
  return {
    caution: true,
    text:
      `${sessionsPerWeek} days a week is high load — only one is a hard day; the rest stay ` +
      'low-intensity volume and mobility. Prioritise sleep, and take a full rest day if anything tweaks.',
  };
}
