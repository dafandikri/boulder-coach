import { describe, expect, it } from 'vitest';
import {
  THEME_ATTR,
  THEME_KEY,
  applyTheme,
  isTheme,
  nextTheme,
  resolveTheme,
  type Theme,
  type ThemeRoot,
} from '@/app/lib/theme';

/**
 * BC-25 — dark mode. The theme decision logic lives here (covered) so the
 * gate-blind toggle component + the no-flash inline script only do DOM/storage
 * I/O. These tests pin every branch of the resolve/toggle/apply contract.
 */

/** A minimal fake of the bits of an HTMLElement we touch, for applyTheme. */
function fakeRoot(): ThemeRoot & { attrs: Record<string, string> } {
  const attrs: Record<string, string> = {};
  return {
    attrs,
    style: { colorScheme: '' },
    setAttribute(name: string, value: string) {
      attrs[name] = value;
    },
  };
}

describe('isTheme', () => {
  it('accepts the two valid themes', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
  });

  it('rejects anything else, including null/undefined', () => {
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme('')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('uses a valid stored choice over the system preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('falls back to the system preference when nothing valid is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('treats a corrupt stored value as no choice (system preference wins)', () => {
    expect(resolveTheme('garbage', true)).toBe('dark');
    expect(resolveTheme('garbage', false)).toBe('light');
  });
});

describe('nextTheme', () => {
  it('toggles between light and dark', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('writes the data-theme attribute and native color-scheme for dark', () => {
    const root = fakeRoot();
    applyTheme('dark', root);
    expect(root.attrs[THEME_ATTR]).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('writes the data-theme attribute and native color-scheme for light', () => {
    const root = fakeRoot();
    applyTheme('light', root);
    expect(root.attrs[THEME_ATTR]).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('constants', () => {
  it('exposes the persistence key and attribute name the inline script also uses', () => {
    expect(THEME_KEY).toBe('bc:theme');
    expect(THEME_ATTR).toBe('data-theme');
  });

  it('Theme type round-trips through the helpers', () => {
    const t: Theme = resolveTheme(null, true);
    expect(isTheme(t)).toBe(true);
  });
});
