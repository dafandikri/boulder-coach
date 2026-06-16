# BC-55 Indonesian i18n — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax
> for tracking.

**Goal:** Add a typed EN/ID internationalization seam with an Indonesian-first language toggle, so every
user-facing string resolves through one covered, parity-gated dictionary.

**Architecture:** A pure typed dictionary (`src/app/lib/i18n.ts`) is the i18n sibling of BC-25's
`theme.ts` — it owns the decision logic (`resolveLocale`/`nextLocale`/`isLocale`/`t`/`plural`); a client
`LocaleProvider` + `useT()` hook expose the live locale; a gate-blind `LanguageToggle` and a no-flash inline
script do only storage/DOM I/O. A Tier-1 test enforces EN/ID key + placeholder parity so an untranslated key
can never ship. Pages call `t('key')` — copy lives in the covered dictionary, not gate-blind JSX.

**Tech Stack:** Next.js 16 App Router (static export PWA), TypeScript (no `any`), Vitest (per-file
coverage), Playwright e2e. No new runtime dependency (next-intl rejected — see
`docs/specs/i18n-indonesian-design.md` §4).

**Spec:** `docs/specs/i18n-indonesian-design.md`. Read it first.

---

### Task 1: The i18n seam core (`i18n.ts`)

**Files:**

- Create: `src/app/lib/i18n.ts`
- Test: `tests/app/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveLocale, isLocale, nextLocale, t, plural, en, id } from '@/app/lib/i18n';

describe('resolveLocale', () => {
  it('explicit stored choice wins', () => {
    expect(resolveLocale('id', 'en-US')).toBe('id');
    expect(resolveLocale('en', 'id-ID')).toBe('en');
  });
  it('falls back to navigator.language when no stored choice', () => {
    expect(resolveLocale(null, 'id-ID')).toBe('id');
    expect(resolveLocale(undefined, 'en-GB')).toBe('en');
    expect(resolveLocale('garbage', 'id')).toBe('id'); // corrupt stored = no choice
  });
});

describe('isLocale / nextLocale', () => {
  it('narrows valid locales and flips', () => {
    expect(isLocale('id')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(nextLocale('en')).toBe('id');
    expect(nextLocale('id')).toBe('en');
  });
});

describe('t', () => {
  it('looks up a key and interpolates {params}', () => {
    // uses a real shipped key so the test also guards the dictionary contract
    expect(t('en', 'nav.today')).toBe('Today');
    expect(t('id', 'nav.today')).toBe('Beranda');
  });
  it('interpolates placeholders', () => {
    expect(t('en', 'today.blocksMeta', { count: 5 })).toContain('5');
  });
});

describe('plural', () => {
  it('English switches one/other; Indonesian uses other (no noun plural)', () => {
    expect(plural('en', 1, { one: '1 session', other: '{n} sessions' })).toBe('1 session');
    expect(plural('en', 3, { one: '1 session', other: '{n} sessions' })).toBe('3 sessions');
    expect(plural('id', 3, { one: '', other: '{n} sesi' })).toBe('3 sesi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/app/i18n.test.ts`
Expected: FAIL — `i18n.ts` does not exist / exports undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/lib/i18n.ts
// BC-55 — typed i18n seam. The decision logic (which locale, how to translate) lives
// here in a covered layer, mirroring BC-25's theme.ts; the gate-blind LanguageToggle
// and the no-flash inline <script> only do storage/DOM I/O. The inline script
// duplicates resolveLocale in plain JS (it runs before the bundle to set <html lang>);
// this file is the canonical, tested source — keep them in sync.

export type Locale = 'en' | 'id';

/** localStorage key holding the user's explicit choice (absent = follow navigator). */
export const LOCALE_KEY = 'bc:locale';

/** The English dictionary IS the key schema: MessageKey = keyof typeof en. ID must match. */
export const en = {
  'nav.today': 'Today',
  'nav.insights': 'Insights',
  'nav.program': 'Program',
  'nav.drills': 'Drills',
  'nav.you': 'You',
  'today.blocksMeta': '{count} blocks · ~60 min',
  // …grows as surfaces migrate (Tasks 5–6). EN values are the current copy, verbatim.
} as const;

export type MessageKey = keyof typeof en;

export const id: Record<MessageKey, string> = {
  'nav.today': 'Beranda',
  'nav.insights': 'Wawasan',
  'nav.program': 'Program',
  'nav.drills': 'Latihan',
  'nav.you': 'Kamu',
  'today.blocksMeta': '{count} blok · ~60 mnt',
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'id';
}

/** Explicit stored choice wins; else honour the device language (id* → id). */
export function resolveLocale(stored: string | null | undefined, navLang: string): Locale {
  if (isLocale(stored)) return stored;
  return navLang.toLowerCase().startsWith('id') ? 'id' : 'en';
}

export function nextLocale(current: Locale): Locale {
  return current === 'en' ? 'id' : 'en';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

/** Translate a key in a locale, interpolating {placeholders}. */
export function t(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const dict = locale === 'id' ? id : en;
  return interpolate(dict[key], params);
}

/** Indonesian nouns don't inflect for number; English needs one/other. `{n}` → count. */
export function plural(locale: Locale, n: number, forms: { one: string; other: string }): string {
  const form = locale === 'en' && n === 1 ? forms.one : forms.other;
  return form.replace(/\{n\}/g, String(n));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/app/i18n.test.ts`
Expected: PASS (5+ tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/i18n.ts tests/app/i18n.test.ts
git commit -m "feat(i18n): BC-55 typed EN/ID dictionary seam (resolveLocale/t/plural)"
```

---

### Task 2: Tier-1 parity gate (untranslated keys fail the build)

**Files:**

- Create: `tests/i18n/dictionary.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { en, id } from '@/app/lib/i18n';

const placeholders = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort();

describe('EN/ID dictionary parity (Tier-1 — no untranslated key can ship)', () => {
  const enKeys = Object.keys(en).sort();
  const idKeys = Object.keys(id).sort();

  it('has identical key sets in both locales', () => {
    expect(idKeys).toEqual(enKeys);
  });

  it('has no empty values', () => {
    for (const k of enKeys) expect(en[k as keyof typeof en], `en[${k}]`).not.toBe('');
    for (const k of idKeys) expect(id[k as keyof typeof id], `id[${k}]`).not.toBe('');
  });

  it('has matching {placeholder} tokens per key across locales', () => {
    for (const k of enKeys) {
      const key = k as keyof typeof en;
      expect(placeholders(id[key]), `placeholders mismatch for "${k}"`).toEqual(
        placeholders(en[key]),
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes (non-vacuous check)**

Run: `pnpm vitest run tests/i18n/dictionary.test.ts`
Expected: PASS. Then temporarily delete one key from `id` in `i18n.ts`, re-run, confirm it FAILS by name,
and restore the key. (Proves the gate is real.)

- [ ] **Step 3: Commit**

```bash
git add tests/i18n/dictionary.test.ts
git commit -m "test(i18n): BC-55 Tier-1 EN/ID key + placeholder parity gate"
```

---

### Task 3: Live-locale context (`LocaleProvider` + `useT`)

**Files:**

- Create: `src/app/components/LocaleProvider.tsx`
- Test: `tests/app/localeProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LocaleProvider, useT, useLocale } from '@/app/components/LocaleProvider';

function Probe() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  return (
    <button
      onClick={() => {
        setLocale('id');
      }}
    >
      {t('nav.today')} · {locale}
    </button>
  );
}

describe('LocaleProvider', () => {
  it('renders the resolved locale and switches live', () => {
    render(
      <LocaleProvider initial="en">
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByRole('button').textContent).toContain('Today');
    act(() => {
      screen.getByRole('button').click();
    });
    expect(screen.getByRole('button').textContent).toContain('Beranda');
  });
});
```

> Note: `@testing-library/react` + `jsdom` env. If the repo's vitest config is `node`, add a
> `// @vitest-environment jsdom` pragma at the top of this test file (check `vitest.config.ts` first).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/app/localeProvider.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  LOCALE_KEY,
  resolveLocale,
  t as translate,
  type Locale,
  type MessageKey,
} from '@/app/lib/i18n';

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}
const Ctx = createContext<LocaleCtx | null>(null);

/** Provider holding the live locale. `initial` lets tests seed it; in the app the
 *  lazy initialiser reads storage + navigator (SSR-safe, no effect setState — the
 *  Next 16 react-hooks/set-state-in-effect rule, matching ThemeToggle). */
export function LocaleProvider({ initial, children }: { initial?: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initial) return initial;
    if (typeof window === 'undefined') return 'en';
    try {
      return resolveLocale(localStorage.getItem(LOCALE_KEY), navigator.language);
    } catch {
      return resolveLocale(null, 'en');
    }
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof document !== 'undefined') document.documentElement.lang = l;
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* private-mode/quota — in-memory state still updates this session */
    }
  }, []);

  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocale must be used within <LocaleProvider>');
  return ctx;
}

/** The hook pages call: returns a `t` bound to the live locale. */
export function useT(): (key: MessageKey, params?: Record<string, string | number>) => string {
  const { locale } = useLocale();
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/app/localeProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/LocaleProvider.tsx tests/app/localeProvider.test.tsx
git commit -m "feat(i18n): BC-55 LocaleProvider + useT live-locale hook"
```

---

### Task 4: Wire layout + toggle + prove one surface end-to-end

**Files:**

- Modify: `src/app/layout.tsx` (wrap tree in `<LocaleProvider>`; add no-flash `lang` inline script)
- Create: `src/app/components/LanguageToggle.tsx`
- Modify: `src/app/components/BottomNav.tsx` (labels via `useT`)
- Modify: `src/app/profile/page.tsx` (render `<LanguageToggle>` beside `<ThemeToggle>`)

- [ ] **Step 1: Add the no-flash `lang` inline script + provider to `layout.tsx`**

In the existing `<body>` (next to BC-25's theme inline script), add a script that sets `<html lang>` before
paint, then wrap children:

```tsx
// inside <body>, alongside the existing theme no-flash script:
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var s=localStorage.getItem('bc:locale');var n=(navigator.language||'en').toLowerCase();var l=(s==='en'||s==='id')?s:(n.indexOf('id')===0?'id':'en');document.documentElement.lang=l;}catch(e){}})();`,
  }}
/>
```

```tsx
// wrap the app tree (import LocaleProvider at top):
<LocaleProvider>{children}</LocaleProvider>
```

- [ ] **Step 2: Create `LanguageToggle.tsx` (mirror ThemeToggle)**

```tsx
'use client';

import { Button } from './Button';
import { useLocale } from './LocaleProvider';
import { nextLocale } from '@/app/lib/i18n';

/** BC-55 — EN/ID toggle for Settings. Decision logic lives in the covered i18n lib +
 *  LocaleProvider; this only triggers the switch (gate-blind). */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <Button
      variant="secondary"
      icon="globe"
      fullWidth
      aria-pressed={locale === 'id'}
      onClick={() => {
        setLocale(nextLocale(locale));
      }}
    >
      {locale === 'id'
        ? 'Bahasa: Indonesia — ketuk untuk English'
        : 'Language: English — tap for Indonesia'}
    </Button>
  );
}
```

> If `Icon.tsx` has no `globe`, add it (mirror the BC-25 `sun` icon addition) or reuse an existing icon.

- [ ] **Step 3: Migrate `BottomNav` labels via `useT`**

Replace the hardcoded `label` strings with `t('nav.today')` etc. Since `TABS` is a module constant, move
label resolution into the component body: `const t = useT();` then render `t(tab.labelKey)` where
`labelKey` is the `MessageKey` (`'nav.today'`, …). Keep `href`/`icon` as-is.

- [ ] **Step 4: Render the toggle in Settings**

In `src/app/profile/page.tsx`, in the same Appearance/Settings group as `<ThemeToggle />`, add
`<LanguageToggle />`.

- [ ] **Step 5: Run the gate + an e2e smoke**

Run: `pnpm gate`
Expected: PASS (format/lint/tsc/depcruise/type-coverage/tests+coverage/knip/build/bundlesize). Confirm the
bundle is still ≤ 200 KB.
Add/extend an e2e (`e2e/i18n.spec.ts`) asserting: load defaults to EN; tap the toggle in Settings; nav
labels flip to Indonesian and `<html lang>` becomes `id`.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/components/LanguageToggle.tsx src/app/components/BottomNav.tsx src/app/profile/page.tsx e2e/i18n.spec.ts
git commit -m "feat(i18n): BC-55 language toggle + lang script; migrate BottomNav"
```

---

### Task 5: Extract chrome & navigation copy (mechanical, per file)

**Files (modify, one commit per file to keep diffs reviewable):**
`src/app/page.tsx`, `src/app/history/page.tsx`, `src/app/drills/page.tsx`, `src/app/exercises/page.tsx`,
`src/app/program/page.tsx`, plus shared components with literal copy (`Callout` titles, `SessionCard`,
empty-states).

**Pattern for every file (repeat per string):**

- [ ] **Step 1:** For each user-facing literal, add a `MessageKey` to `en` (value = the current string,
      verbatim) and the ID translation to `id` in `i18n.ts`. Use a dotted namespace (`history.empty`,
      `today.restCta`, …).
- [ ] **Step 2:** In the page, `const t = useT();` and replace the literal with `t('key')` (or
      `t('key', { count })` / `plural(locale, n, …)` for counts).
- [ ] **Step 3:** Replace any `toLocaleDateString('en-US', …)` with the active locale (read `locale` from
      `useLocale()`), e.g. `d.toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-US', …)`.
- [ ] **Step 4:** Run `pnpm vitest run tests/i18n/dictionary.test.ts` — the parity gate must stay green
      (every new EN key has its ID twin).
- [ ] **Step 5:** Commit per file: `git commit -m "feat(i18n): BC-55 localize <page>"`.

Do NOT touch `src/domain/**` content strings (drills/exercise `steps`/`cues`) — out of scope (spec §2).

---

### Task 6: Extract the coaching surface + author the glossary

**Files (modify):** `src/app/profile/page.tsx` (onboarding), `src/app/checkin/page.tsx`,
`src/app/session/page.tsx` (incl. the BC-65 attempt/send explainer copy), `src/app/insights/page.tsx`,
`src/app/lib/explainers.ts` (ACWR/RPE band copy), `src/app/components/MetricExplainer.tsx` if it holds
literals.

- [ ] **Step 1:** Move the ACWR/RPE explainer copy in `explainers.ts` behind keys; author the ID gloss per
      the spec §8 glossary (e.g. `RPE` → "RPE — tingkat usaha 1–10", `ACWR` → "ACWR — rasio beban
      akut:kronis", send → "tuntas", flash → "flash (tuntas sekali coba)"). `explainers.ts` is already covered —
      keep its tests green.
- [ ] **Step 2:** Localize onboarding/check-in/session/insights literals via `t` (same pattern as Task 5).
- [ ] **Step 3:** Run `pnpm vitest run tests/i18n/dictionary.test.ts` and the existing `explainers` tests —
      all green.
- [ ] **Step 4:** Commit per surface.

---

### Task 7: Localize adaptation reasons (SAFETY slice — isolated)

**Files:**

- Modify: `src/domain/types.ts` (`AdaptationChange`), `src/domain/adaptation.ts` (**safety file**),
  `src/domain/periodization.ts` (re-ramp reason), `tests/domain/adaptation.test.ts`,
  `src/app/page.tsx` / `src/app/insights/page.tsx` (render localized reason)

> **REQUIRED before editing the safety files:** read `skills/safety-critical-change.md`, use the
> `domain-rule-authoring` skill, and run the `safety-rule-reviewer` agent after the edit. The
> `adaptation.invariants.test.ts` fuzzer and `pnpm test:safety` must stay green; `adaptation.ts` holds 100%
> branch. The mutation gate (BC-35) already ignores reason strings, so the score is unaffected.

- [ ] **Step 1: Write the failing test** — `AdaptationChange` gains a structured, localizable reason:

```ts
// tests/domain/adaptation.test.ts — add
it('emits a structured, localizable reason (key + params), not baked English', () => {
  // build a check-in that fires the ACWR>1.5 deload rule, then:
  const change = result.changes.find((c) => c.ruleId === 'acwr-high');
  expect(change?.messageKey).toBe('reason.acwrHigh');
  expect(change?.messageParams).toMatchObject({ acwr: expect.any(Number) });
});
```

- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm vitest run tests/domain/adaptation.test.ts` →
      FAIL (`messageKey` undefined).

- [ ] **Step 3: Implement.** In `types.ts`, extend `AdaptationChange` to
      `{ ruleId: string; messageKey: ReasonKey; messageParams?: Record<string, string | number>; reason: string }`
      — keep `reason` as the EN fallback so nothing else breaks. In `adaptation.ts`, set `messageKey`/
      `messageParams` alongside the existing `reason` for each rule. Add the `reason.*` keys (EN + ID) to
      `i18n.ts`. The UI renders `t(change.messageKey, change.messageParams)` instead of `change.reason`.

- [ ] **Step 4: Run safety checks.**

Run: `pnpm test:safety` then `pnpm vitest run tests/domain/adaptation.invariants.test.ts`
Expected: PASS. Then run the `safety-rule-reviewer` agent on the `adaptation.ts` diff — must return PASS.

- [ ] **Step 5: Run the full gate + parity.** Run: `pnpm gate` → PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/domain/types.ts src/domain/adaptation.ts src/domain/periodization.ts src/app/lib/i18n.ts tests/domain/adaptation.test.ts src/app/page.tsx src/app/insights/page.tsx
git commit -m "feat(i18n): BC-55 localize adaptation reasons (structured key/params) [safety]"
```

---

## Self-review (against the spec)

- **Spec coverage:** seam (T1) ✓, Tier-1 parity gate §7 (T2) ✓, provider/hook §5 (T3) ✓, toggle +
  persistence + `<html lang>` §6 (T4) ✓, chrome extraction slice 3 (T5) ✓, coaching surface + glossary §8
  slice 4 (T6) ✓, adaptation-reason safety slice §8/slice 5 (T7) ✓. Content-catalog translation is
  explicitly out of scope (spec §2) — no task, by design.
- **Placeholder scan:** Tasks 5–6 are deliberately pattern-based (mechanical per-string extraction across
  ~12 files); the pattern, key-naming, and parity-gate guardrail are concrete. This is the one acceptable
  "repeat the pattern" case — enumerating ~200 strings verbatim would bloat the plan without adding
  information, and the Tier-1 parity test mechanically catches any miss.
- **Type consistency:** `Locale`, `MessageKey`, `t(locale, key, params?)`, `plural(locale, n, {one,other})`,
  `useT()`, `useLocale()`, `LOCALE_KEY`/`LOCALE` attr usage are consistent across Tasks 1–7. `en` is the key
  schema; `id: Record<MessageKey, string>` is enforced by both the compiler and the T2 parity test.

## Execution handoff

Slices are independently gate-green: **Tasks 1–4 deliver a working toggle on one surface** and can ship
first; Tasks 5–6 are incremental copy migration (per-file commits); Task 7 is the isolated safety slice.
Recommend subagent-driven execution (fresh subagent per task, review between) given the safety slice and
the repetitive extraction benefit from isolated context.
