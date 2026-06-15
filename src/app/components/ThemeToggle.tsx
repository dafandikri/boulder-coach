'use client';

import { useState } from 'react';
import { Button } from './Button';
import { THEME_KEY, applyTheme, nextTheme, resolveTheme, type Theme } from '@/app/lib/theme';

/**
 * BC-25 — light/dark toggle for the Settings screen. All decision logic lives in
 * the covered `@/app/lib/theme`; this component only reads the current state from
 * the DOM/storage and writes the user's choice back (gate-blind I/O). The initial
 * value is derived once via a lazy SSR-safe `useState` initialiser — no
 * effect-driven setState, which Next 16's `react-hooks/set-state-in-effect` rule
 * forbids (the trap that bit BC-39/BC-20).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    try {
      return resolveTheme(localStorage.getItem(THEME_KEY), prefersDark);
    } catch {
      // Storage blocked (sandboxed iframe / cookies-off) — accessing localStorage
      // can throw, not just setItem. Fall back to the OS preference, same as the
      // no-flash inline script's try/catch.
      return resolveTheme(null, prefersDark);
    }
  });

  function toggle(): void {
    const next = nextTheme(theme);
    setTheme(next);
    applyTheme(next, document.documentElement);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private-mode / quota — the in-memory + DOM state still updates this session.
    }
  }

  const isDark = theme === 'dark';
  return (
    <Button
      variant="secondary"
      icon={isDark ? 'sun' : 'moon'}
      fullWidth
      aria-pressed={isDark}
      onClick={toggle}
    >
      {isDark ? 'Dark mode on — tap for light' : 'Switch to dark mode'}
    </Button>
  );
}
