import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FIELD_STYLE } from '../../src/app/lib/fieldStyles';

// Tier-1 guard: frontend form-field consistency is now executable, not a review note.
//
// Background — the SAME design-drift bug shipped TWICE: a page hand-rolled an inline
// form-field box with off-canonical tokens (`--r-sm`, `--font-mono`, `--fs-sm`) instead of
// matching the rest of the app, so the screen read as smaller / monospaced / off-brand:
//   • BC-67 — the /log quick-log form (date / duration / note).
//   • BC-60 — the session "sets" input.
// Both were caught by EYE and fixed by HAND. Per the ledger's promotion rule
// (≥2× → promote to an automated check), the canonical field box now lives in ONE place
// (`src/app/lib/fieldStyles.ts` → `FIELD_STYLE`) and this test forbids any page from
// re-rolling it inline. A new divergent field fails the gate by name. (BC-71.)

const root = process.cwd();
const appDir = join(root, 'src/app');

/** All page.tsx files under src/app (pages compose; the design-system primitives in
 *  src/app/components own box styling and are intentionally exempt). */
function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pageFiles(full));
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

/** Return every `{…}` object body that follows `style={{` or `: CSSProperties = {`,
 *  using balanced-brace matching (robust to multi-line objects). */
function styleObjectBodies(src: string): string[] {
  const bodies: string[] = [];
  const pushBalanced = (openIdx: number): void => {
    let depth = 0;
    for (let i = openIdx; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) {
        bodies.push(src.slice(openIdx, i + 1));
        return;
      }
    }
  };
  // `style={{` — the object is the SECOND brace.
  for (const m of src.matchAll(/style=\{\s*\{/g)) {
    pushBalanced(m.index + m[0].lastIndexOf('{'));
  }
  // `: CSSProperties = {` — a local field-style const.
  for (const m of src.matchAll(/:\s*CSSProperties\s*=\s*\{/g)) {
    pushBalanced(m.index + m[0].lastIndexOf('{'));
  }
  return bodies;
}

/** The field-box signature: a padded, rounded, bordered box that also sets a font family.
 *  Only a text-entry field needs all four together — Cards/dividers/steppers never do
 *  (a divider sets `borderTop`, a stepper omits padding + fontFamily), so this is
 *  false-positive-free. A spread (`...FIELD_STYLE`) inherits these, so it never matches. */
function isFieldBox(body: string): boolean {
  return (
    /borderRadius/.test(body) &&
    /\bborder:/.test(body) &&
    /padding/.test(body) &&
    /fontFamily/.test(body)
  );
}

describe('FIELD_STYLE is the single canonical form-field box', () => {
  it('reads from design-system tokens, never raw px/hex', () => {
    expect(FIELD_STYLE.borderRadius).toBe('var(--r-md)');
    expect(FIELD_STYLE.border).toBe('2px solid var(--border)');
    expect(FIELD_STYLE.background).toBe('var(--surface)');
    expect(FIELD_STYLE.color).toBe('var(--text)');
    expect(FIELD_STYLE.fontFamily).toBe('var(--font-body)');
    expect(FIELD_STYLE.fontSize).toBe('var(--fs-base)');
  });
});

describe('no page re-rolls the form-field box inline (use the shared FIELD_STYLE)', () => {
  const pages = pageFiles(appDir);

  it('finds the pages to scan (guard is not vacuous)', () => {
    expect(pages.length).toBeGreaterThan(5);
  });

  for (const file of pageFiles(appDir)) {
    const rel = relative(root, file);
    it(`${rel} has no hand-rolled field box`, () => {
      const offenders = styleObjectBodies(readFileSync(file, 'utf8')).filter(isFieldBox);
      expect(
        offenders,
        `${rel} inlines a form-field box (borderRadius+border+padding+fontFamily). ` +
          `Use the shared FIELD_STYLE from '@/app/lib/fieldStyles' (spread it for size/layout) ` +
          `so the field matches the rest of the app. See BC-67/BC-60/BC-71.`,
      ).toEqual([]);
    });
  }
});

describe('the field-box detector itself is correct (non-vacuous)', () => {
  it('flags a hand-rolled divergent field box', () => {
    const bad = `style={{ width: 64, borderRadius: 'var(--r-sm)', border: '2px solid var(--border)', padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}`;
    expect(styleObjectBodies(bad).some(isFieldBox)).toBe(true);
  });

  it('ignores a shared-style spread (the correct pattern)', () => {
    const good = `style={{ ...FIELD_STYLE, width: 64, padding: '4px 8px' }}`;
    expect(styleObjectBodies(good).some(isFieldBox)).toBe(false);
  });

  it('ignores a non-field box (mono caption: font but no border/radius/padding)', () => {
    const caption = `style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-soft)', fontFamily: 'var(--font-mono)' }}`;
    expect(styleObjectBodies(caption).some(isFieldBox)).toBe(false);
  });

  it('ignores a divider/stepper (borderTop or border without padding+fontFamily)', () => {
    const stepper = `const btn: CSSProperties = { height: 32, borderRadius: 'var(--r-sm)', border: '2px solid var(--border)', fontWeight: 800 }`;
    expect(styleObjectBodies(stepper).some(isFieldBox)).toBe(false);
  });
});
