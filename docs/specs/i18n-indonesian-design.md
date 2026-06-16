# Indonesian-first i18n with EN/ID toggle — design (BC-55)

**Date:** 2026-06-16
**Status:** Design — pending implementation plan approval (plan: `docs/plans/i18n-indonesian-plan.md`)
**Author:** dafandikri (PO) · drafted by Claude Opus 4.8 (brainstorming session)
**Folds in:** BC-56's jargon-reduction (copy authored intuitively **once**, in both languages)
**Library decision grounded via Context7:** `next-intl` (`/amannn/next-intl`) — weighed and **not** chosen
(§4).

---

## 1. Problem

The product's stated primary audience is **Indonesian boulderers** (spec author intent; user memory), but
**every user-facing string is hardcoded English** across ~12 page/component files, and the coaching surface
leans on jargon (ACWR, RPE, "send", "flash", "deload"). There is **no i18n seam** — language can't be
changed, and Indonesian is not a first-class language. This is the single biggest _adoption_ blocker for
the target market. The app is also globally friendly, so language must be a **toggle (ID + EN)** with
Indonesian authored as a first-class language, not a machine-translation afterthought.

## 2. Goals / Non-goals

**Goals**

- A **typed i18n seam** so any user-facing string resolves through one place, type-safe, with **EN and ID**
  both authored.
- A **language toggle** in Settings (beside the BC-25 theme toggle), persisted locally, that **respects
  `navigator.language` on first load** and an explicit choice thereafter.
- **Indonesian authored intuitively** — domain terms get a plain-language ID gloss (not literal
  translation); this is where BC-56's "less jargon" lives, done once in both languages.
- A **Tier-1 gate** that fails the build if any key is missing in either locale or if interpolation
  placeholders drift between locales — so "an untranslated key renders" becomes impossible, not just
  unlikely.
- **No bundle regression** beyond the dictionary itself (budget 200 KB, currently 167.8 KB — BC-36).

**Non-goals (this iteration)**

- URL-routed locales (`/id`, `/en`). Locale is a client toggle, not a route — this app is a
  statically-exported client PWA (see §4).
- More than two locales. The seam is N-locale-ready, but only EN + ID ship.
- **Translating the instructional content catalog** (drills/off-wall/warm-up `steps`/`cues`/
  `commonMistakes` — the BC-62 `src/domain/content/` surface). That's a large, separate translation
  surface; BC-62's consolidation makes it explicit and it becomes its own follow-on PBI. **BC-55 covers
  app chrome, onboarding, metrics/explainers, and the coaching-decision copy** (see §8 for the adaptation
  reasons boundary).
- Server-side locale negotiation / SEO hreflang (no server render to negotiate in; §4).

## 3. The two real options

|                   | **A. Typed dictionary (`src/app/lib/i18n.ts`)**      | **B. next-intl**                                            |
| ----------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Fit to this app   | **High** — client-rendered, toggle-based, static PWA | Low — built for Server Components + URL routing             |
| Bundle            | Just the strings + a ~20-line `t()`                  | Provider + ICU parser + lib (risks the 200 KB budget)       |
| Testability       | **Pure, covered, Tier-1 parity test**                | Runtime/provider; key-parity not enforced by default        |
| Repo-pattern fit  | **Mirrors BC-25 `theme.ts` exactly**                 | New paradigm (`getRequestConfig`, `NextIntlClientProvider`) |
| ICU plural/format | Tiny helper + built-in `Intl.*`                      | Built-in ICU (richer than we need for 2 locales)            |
| Cost of leaving   | Low (it's ~1 file + a hook)                          | Higher (provider wiring throughout)                         |

## 4. Decision — typed dictionary (Option A)

Context7 confirms next-intl centres on `getRequestConfig` (reads the locale from a **cookie/headers on the
server**) and `NextIntlClientProvider` to hydrate Client Components. **This app has no server locale
lifecycle to use:** almost every page is `'use client'` reading IndexedDB in effects, the build is a static
export, and locale is a **localStorage toggle**, not a URL segment. We'd pay next-intl's bundle + provider
cost to use almost none of its value, and it doesn't enforce key parity (our actual risk).

A typed dictionary fits the repo's established shape — it is the **i18n sibling of BC-25's `theme.ts`**
(`resolveTheme`→`resolveLocale`, `nextTheme`→`nextLocale`, `isTheme`→`isLocale`, `ThemeToggle`→
`LanguageToggle`, the no-flash inline script that sets `data-theme`→ also sets `lang`). It keeps **all copy
in a covered module**, makes parity a **unit-tested invariant**, and adds ~the byte cost of the ID strings
only. **Trade-off accepted:** we hand-roll a tiny `{placeholder}` interpolation + a minimal `plural()`
helper instead of ICU — trivial for two locales and a handful of count strings.

## 5. Architecture (isolation-first)

```
src/app/lib/i18n.ts            (PURE/covered — the seam)
  type Locale = 'en' | 'id'
  type MessageKey = keyof typeof en          // union of all keys, type-safe
  const en: Record<MessageKey, string>       // current English copy, verbatim
  const id: Record<MessageKey, string>       // authored Indonesian
  resolveLocale(stored, navLang) → Locale    // explicit stored wins, else navLang startsWith 'id'
  isLocale(v) / nextLocale(l)                // mirror theme.ts
  t(locale, key, params?) → string           // lookup + {placeholder} interpolation
  plural(locale, n, {one, other}) → string   // EN s/no-s; ID has no noun plural

src/app/components/LocaleProvider.tsx  (client) — context holding the live locale
  - initial value via lazy SSR-safe useState (resolveLocale(localStorage, navigator.language))
  - setLocale persists to localStorage + updates <html lang>
  useT() → (key, params?) => t(locale, key, params)   // the hook pages call

src/app/components/LanguageToggle.tsx  (gate-blind) — Settings control (beside ThemeToggle)

src/app/layout.tsx  — no-flash inline <script> sets <html lang> before paint (BC-25 pattern);
                      wraps the tree in <LocaleProvider>

tests/i18n/dictionary.test.ts  (Tier-1) — en/id key parity + placeholder parity (§7)
```

**Pages stay thin:** a page calls `const t = useT(); … t('today.start')`. The _content_ lives in the
covered dictionary (satisfying logic-in-covered-layers — copy is no longer trapped in gate-blind JSX), even
though the call site is the page.

## 6. Locale resolution & persistence

- **First load:** `resolveLocale(localStorage['bc-locale'] ?? null, navigator.language)` — explicit stored
  choice wins; else `navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en'`. (Same precedence as
  BC-25's `resolveTheme`.)
- **Toggle:** `LanguageToggle` calls `setLocale(nextLocale(current))`, persists `bc-locale`, updates
  `<html lang>`. `aria-pressed`/labelled like `ThemeToggle`.
- **`<html lang>`:** set by the no-flash inline script on first paint and kept in sync on toggle — correct
  for a11y/screen-readers and `:lang()` CSS.
- **Minor first-paint note:** because text is client-rendered, the very first paint uses the resolved
  locale on mount; there's no server pre-render to mismatch (static export). No hydration-mismatch risk
  since the provider reads the same source on client init. Acceptable; documented.

## 7. The Tier-1 gate (make "untranslated" impossible)

`tests/i18n/dictionary.test.ts` asserts, by **filename** (fails the gate):

1. **Key parity:** `Object.keys(en)` ≡ `Object.keys(id)` — no key missing in either, no extra key.
2. **Placeholder parity:** for each key, the set of `{tokens}` in `en[key]` ≡ those in `id[key]` — so
   `t()` can never leave a `{name}` unfilled because a translator dropped it.
3. **Non-empty:** no value is `''` in either locale.
4. (**Stretch, optional**) a lint/scan flag for raw user-facing string literals left in `page.tsx` JSX —
   if cheap via an ESLint `no-literal-string`-style rule scoped to pages; otherwise a documented review
   step. The parity test is the load-bearing guarantee; the scan is belt-and-suspenders.

This promotes BC-55's "no untranslated key renders" from prose to **executable** (the repo's Tier-1 ethos).

## 8. Domain terms, jargon glosses & the adaptation-reason boundary (folds BC-56)

**Principle:** author Indonesian as plain language, not literal translation. Glossary the spec commits to
(authored with the brand-owner/PO, refined in the plan):

| Term          | EN               | ID (intuitive)                     |
| ------------- | ---------------- | ---------------------------------- |
| send          | send / topped    | **tuntas** (topout)                |
| flash         | flash            | **flash** (tuntas sekali coba)     |
| attempt       | attempt          | **percobaan**                      |
| limit boulder | limit bouldering | **boulder batas (maksimal)**       |
| deload        | deload week      | **minggu pemulihan**               |
| RPE           | RPE (1–10)       | **RPE — tingkat usaha 1–10**       |
| ACWR          | ACWR             | **ACWR — rasio beban akut:kronis** |
| readiness     | readiness        | **kesiapan**                       |

These keep the recognized term + an intuitive gloss (the explainers — ACWR/RPE from `explainers.ts`, and
BC-65's attempt/send explainer — get full ID copy).

**Adaptation reasons (the one notable refactor):** `AdaptationChange.reason` is **English prose generated
inside `src/domain/adaptation.ts` — a safety file** (e.g. "Wrist pain flagged — removed sloper limit
work…"). Two options:

- **Now:** keep reasons English in the first i18n slices (they're explanatory; churning a safety file for
  copy is undesirable). The app is Indonesian for all _chrome/onboarding/metrics_; reasons remain EN.
- **Dedicated slice (recommended end-state):** restructure `reason: string` → `reason: { key, params }`
  (or add `messageKey`/`messageParams`), localized at render. This touches `adaptation.ts` →
  **safety-critical-change protocol** (safety-rule-reviewer + 100% branch). The mutation-tested invariants
  assert _rule behavior_, not reason text (BC-35 already ignores reason strings), so the risk is low — but
  the protocol still applies. **Plan slice 5** does this explicitly and separately, so the safety review is
  isolated from the bulk copy work.

## 9. Pluralization & formatting

- Indonesian nouns don't inflect for number; English needs s/no-s. A `plural(locale, n, {one, other})`
  helper covers the handful of count strings ("{n} sessions", "{n}-week streak", "X blocks"). Most strings
  have no plural.
- Dates/numbers: use built-in `Intl.DateTimeFormat`/`Intl.NumberFormat` with the active locale where the
  app formats them (e.g. `todayLabel`), replacing the hardcoded `'en-US'` in `page.tsx`.

## 10. Scope boundary & slicing (drives the plan)

1. **Seam + gate (small, gate-green alone):** `i18n.ts` (dictionary scaffold + `t`/`resolveLocale`/
   `plural`), `LocaleProvider`, `useT`, the Tier-1 parity test. Migrate ONE surface (BottomNav + Today
   header) to prove it end-to-end.
2. **Toggle + persistence:** `LanguageToggle` in profile (beside ThemeToggle), `<html lang>` inline script,
   `bc-locale` persistence.
3. **String extraction — chrome & navigation:** all nav/labels/buttons/empty-states across pages → keys;
   EN verbatim, ID authored.
4. **String extraction — coaching surface:** onboarding/profile, check-in, session player (incl. BC-65's
   attempt/send explainer), insights/metrics + the ACWR/RPE explainers, with the §8 glossary.
5. **Adaptation reasons (safety slice, isolated):** `reason: string` → structured key/params + ID copy;
   safety-rule-reviewer; 100% branch on `adaptation.ts` preserved.

Instructional content (drills/exercises catalog) is **out of scope** (separate large surface; tracked as a
follow-on once BC-62 consolidates `src/domain/content/`).

## 11. Testing strategy

- **Pure/covered:** `resolveLocale` (stored-wins, navLang `id`/non-id/undefined), `t` (hit, missing-key
  fallback behaviour, interpolation), `plural` (en one/other, id invariant). Per-file coverage.
- **Tier-1 parity test** (§7) — the executable "no untranslated key" guarantee.
- **e2e (extends BC-37 a11y / BC-16):** toggling language flips visible copy and `<html lang>`; the default
  remains EN so the existing a11y baseline is untouched (run the axe scan in EN, as BC-25 did for dark
  mode); a smoke that ID renders without layout breakage on the longest strings.

## 12. Risks & mitigations

- **Bundle creep** from the ID strings → measured against BC-36; strings are cheap, no new runtime dep.
- **Layout overflow** (Indonesian is often longer) → e2e longest-string smoke; the design system's flexible
  components already wrap.
- **Copy drift** between locales → the parity + placeholder Tier-1 test blocks it.
- **Safety file churn** for reason copy → isolated to slice 5 with the full safety protocol.
- **Scope creep into the content catalog** → explicitly out of scope; gated to a follow-on PBI.

## 13. Decisions log

| Decision             | Choice                                                    | Why not the alternative                                                                                                |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Library              | **Typed dictionary**                                      | next-intl is server/routing-centric; wasted on a client static PWA, risks bundle, doesn't enforce key parity.          |
| Locale source        | **localStorage toggle + `navigator.language` first-load** | URL routing adds no value to a single-view PWA and complicates the static export.                                      |
| Where copy lives     | **One covered dictionary**                                | Keeps copy out of gate-blind JSX; enables the parity gate.                                                             |
| Indonesian authoring | **Hand-authored, intuitive gloss**                        | Machine translation would re-introduce jargon and mistranslate climbing terms.                                         |
| Adaptation reasons   | **Structured key/params in an isolated safety slice**     | Leaving them EN forever half-localizes the coach; baking ID strings into the safety file mixes copy with safety logic. |
| Content catalog      | **Out of scope (follow-on)**                              | Large surface; BC-62 should make it explicit first.                                                                    |

## 14. Open questions for the PO (carry into the plan)

- **ID copy authorship:** PO/native-speaker authored vs I draft + PO reviews? (Recommendation: I draft the
  full ID dictionary with the §8 glossary; PO reviews — fastest path, PO has final say on tone.)
- **Adaptation reasons in v1:** ship slices 1–4 with reasons still EN and do slice 5 next, or block the
  first ID release on slice 5? (Recommendation: ship 1–4 first — most of the app is Indonesian immediately;
  reasons follow in the isolated safety slice.)
