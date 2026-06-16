// BC-60 — parse/normalize/clamp for the session player's "Sets completed" field.
// Kept out of the gate-blind page (logic-in-covered-layers rule): the input binds
// to a raw string for display so it can be momentarily empty, and these pure
// helpers decide what shows while editing vs. what's stored when the field loses
// focus. Pure: no I/O, no React.

/** Lowest storable sets count. */
export const SETS_MIN = 0;
/** Highest storable sets count (matches the old `max={20}` on the input). */
export const SETS_MAX = 20;

/**
 * What the field DISPLAYS while the user is editing. Keeps only digits and drops
 * leading zeros, so the stuck "0" can be deleted (→ "") and typing 8 over a 0
 * shows "8", not "08". Clamping is deliberately NOT done here — a half-typed "25"
 * must be allowed mid-edit; the value is clamped on blur via `normalizeCount`.
 */
export function sanitizeCountInput(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/**
 * What we STORE outside the field. An empty/blank field normalizes to 0; any value
 * is clamped to [SETS_MIN, SETS_MAX]. Parses the raw string directly (Number) so a
 * negative clamps to the min rather than being silently stripped.
 */
export function normalizeCount(raw: string, max = SETS_MAX, min = SETS_MIN): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
