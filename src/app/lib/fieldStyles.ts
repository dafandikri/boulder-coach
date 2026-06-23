import type { CSSProperties } from 'react';

/**
 * The ONE canonical form-field box for the whole app. Every text / number / date
 * `<input>`, `<select>`, and `<textarea>` on a page MUST use this — spread it and
 * override only layout (width / display / margin) or a compact size
 * (padding / fontSize) per field — so no screen re-rolls a divergent field look.
 *
 * This exists because the same drift bug shipped twice: BC-67 (the /log form read
 * as a smaller, monospaced screen) and BC-60 (the session "sets" input). Both
 * hand-rolled an inline field box with off-canonical tokens (`--r-sm`,
 * `--font-mono`, `--fs-sm`) instead of matching the rest of the app. Consolidating
 * here + the Tier-1 guard `tests/harness/design-consistency.test.ts` (which forbids
 * a page from inlining the field-box signature) makes the recurrence impossible.
 *
 * Pure presentational tokens only — never raw px/hex; everything reads from the
 * design-system CSS variables in `globals.css`. (BC-71.)
 */
export const FIELD_STYLE: CSSProperties = {
  borderRadius: 'var(--r-md)',
  border: '2px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 'var(--fs-base)',
  padding: '10px 12px',
};
