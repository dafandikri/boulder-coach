// BC-25 — dark mode. The whole point of separating raw palette from semantic
// aliases in globals.css is that a dark theme only re-points the semantic layer
// under [data-theme='dark'] — so all this module owns is the tiny decision
// logic: which theme to show, how to toggle it, and how to apply it to the DOM.
// Keeping it here (a covered layer) means the gate-blind <ThemeToggle> component
// and the no-flash inline <script> in layout.tsx only do storage/DOM I/O, never
// branch on their own. The inline script necessarily duplicates resolveTheme's
// logic in plain JS because it must run before the bundle loads (no flash); this
// file is the canonical, tested source of that behaviour — keep them in sync.

/** The two themes the app ships. `light` is the original BC-23 brand skin. */
export type Theme = 'light' | 'dark';

/** localStorage key holding the user's explicit choice (absent = follow system). */
export const THEME_KEY = 'bc:theme';

/** The attribute on <html> the dark CSS block keys off (`[data-theme='dark']`). */
export const THEME_ATTR = 'data-theme';

/** Narrow an unknown stored string to a valid `Theme`. */
export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * The theme to show: an explicit, still-valid stored choice always wins;
 * otherwise honour the OS `prefers-color-scheme` (so a dark-by-default device
 * opens dark on first run, no toggle needed). A corrupt stored value is treated
 * as no choice.
 */
export function resolveTheme(stored: string | null | undefined, prefersDark: boolean): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? 'dark' : 'light';
}

/** Flip to the other theme. */
export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * The slice of an `HTMLElement` we need to apply a theme. `document.documentElement`
 * satisfies this structurally at the call site; tests pass a fake — so the DOM
 * write stays in covered code, not the gate-blind component.
 */
export interface ThemeRoot {
  setAttribute(name: string, value: string): void;
  readonly style: { colorScheme: string };
}

/**
 * Apply a theme to the document root: set `data-theme` (drives the CSS tokens)
 * and the native `color-scheme` (so form controls, scrollbars and the UA match).
 */
export function applyTheme(theme: Theme, root: ThemeRoot): void {
  root.setAttribute(THEME_ATTR, theme);
  root.style.colorScheme = theme;
}
