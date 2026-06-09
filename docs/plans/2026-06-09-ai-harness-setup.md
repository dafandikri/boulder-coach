# AI Harness Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production-grade AI development control plane (quality gates, hooks, CI/CD, safety-review agent, learning ledger) around the `boulder-coach` project, prove every gate actually bites, then hand off to the autonomous loop that builds the Plan 1 core engine.

**Architecture:** A single deterministic gate (`scripts/gate.sh`) is the one source of truth, invoked at four escalating tiers — in-loop, pre-commit (husky + lint-staged), pre-push, and CI (GitHub Actions). Static analysis (TS strict, ESLint strict-type-checked, dependency-cruiser, type-coverage, Knip, Semgrep) and dynamic analysis (Vitest + coverage, Playwright) enforce correctness and architecture automatically. A `safety-rule-reviewer` agent guards the injury-safety domain; an append-only `LEARNINGS.md` ledger records every failure and promotes recurring ones into automated checks. Git push/PR is denied to agents by config.

**Tech Stack:** Next.js (App Router) + TypeScript (strict), Tailwind, pnpm, Vitest (+ v8 coverage), Dexie, ESLint (typescript-eslint strict-type-checked), Prettier, dependency-cruiser, type-coverage, Knip, Semgrep, Playwright, Husky v9 + lint-staged, GitHub Actions.

**Source spec:** `docs/superpowers/specs/2026-06-09-ai-harness-design.md`
**Loop target:** `docs/superpowers/plans/2026-06-09-bouldering-coach-core-engine.md` (Plan 1)

---

## File Structure

```
Climbing-App/
  docs/superpowers/
    LEARNINGS.md                     # NEW — append-only failure/learning ledger
  boulder-coach/                     # NEW — scaffolded app + control plane
    CLAUDE.md                        # arch invariants, gate commands, TDD/git/design principles
    package.json                     # scripts: gate, lint, typecheck, depcruise, knip, e2e, prepare
    tsconfig.json                    # strict + noUncheckedIndexedAccess + noImplicitOverride
    eslint.config.mjs                # typescript-eslint strict-type-checked (bans any)
    .prettierrc.json                 # formatting standard
    .prettierignore
    vitest.config.ts                 # coverage thresholds (safety files = 100% branch)
    .dependency-cruiser.cjs          # layering: domain ↛ data ↛ app
    knip.json                        # dead-code / unused-dep config
    playwright.config.ts             # e2e smoke config
    scripts/
      gate.sh                        # THE deterministic gate (single source of truth)
    .husky/
      pre-commit                     # lint-staged (fast: staged-only)
      pre-push                       # scripts/gate.sh (full)
    .lintstagedrc.json               # format + lint staged files
    .github/workflows/
      ci.yml                         # full gate + Semgrep + Knip + Playwright
    .claude/
      settings.json                  # Stop-gate hook + deny git push / gh pr create
      agents/
        safety-rule-reviewer.md      # reviews domain diffs vs spec rule-table
      skills/
        domain-rule-authoring/
          SKILL.md                   # injects canonical ACWR math + 8-row rule table
    e2e/
      today.spec.ts                  # Playwright smoke (added when Today screen exists; placeholder-safe)
```

**Decomposition rationale:** One responsibility per file. `gate.sh` centralises every check so the four tiers never drift. Config files are isolated so a tool can be tuned or swapped without touching others. The `.claude/` control plane is what makes _any_ future session behave correctly.

---

## Task 1: Scaffold the project + git init

**Files:**

- Create: whole `boulder-coach/` project + git repo

- [ ] **Step 1: Scaffold Next.js app (non-interactive)**

Run from `/Users/dafandikri/Documents/Personal/Climbing-App`:

```bash
pnpm create next-app@latest boulder-coach --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm --yes
```

Expected: project created in `boulder-coach/`, exits 0.

- [ ] **Step 2: Initialise git**

```bash
cd boulder-coach && git init && git add -A && git commit -m "chore: scaffold next.js app"
```

Expected: repo initialised, first commit created, exit 0.

- [ ] **Step 3: Add runtime + test/storage deps**

```bash
pnpm add dexie
pnpm add -D vitest @vitest/coverage-v8 fake-indexeddb
```

Expected: installs, exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: add dexie, vitest, coverage, fake-indexeddb"
```

---

## Task 2: TypeScript strict + Vitest config (with coverage thresholds)

**Files:**

- Modify: `boulder-coach/tsconfig.json`
- Create: `boulder-coach/vitest.config.ts`

- [ ] **Step 1: Tighten tsconfig compiler options**

In `tsconfig.json`, ensure the `compilerOptions` object contains these keys (merge — keep the Next.js defaults already present):

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
  },
}
```

- [ ] **Step 2: Create Vitest config with coverage thresholds**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/domain/**', 'src/data/**', 'src/app/lib/**'],
      thresholds: {
        // Safety-critical files: zero tolerance.
        'src/domain/adaptation.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/domain/loadMetrics.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
        // Rest of the domain.
        'src/domain/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        // Everything else covered.
        global: { lines: 90, branches: 80, functions: 90, statements: 90 },
      },
    },
  },
});
```

- [ ] **Step 3: Verify tsc passes on the clean scaffold**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json vitest.config.ts && git commit -m "chore: strict tsconfig + vitest coverage thresholds"
```

---

## Task 3: Prettier + ESLint strict-type-checked

**Files:**

- Create: `boulder-coach/.prettierrc.json`, `boulder-coach/.prettierignore`
- Modify: `boulder-coach/eslint.config.mjs`

- [ ] **Step 1: Add Prettier**

```bash
pnpm add -D prettier eslint-config-prettier
```

Create `.prettierrc.json`:

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

Create `.prettierignore`:

```
.next
node_modules
coverage
pnpm-lock.yaml
```

- [ ] **Step 2: Add typescript-eslint strict-type-checked**

```bash
pnpm add -D typescript-eslint
```

Replace the contents of `eslint.config.mjs`:

```js
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default tseslint.config(
  ...compat.extends('next/core-web-vitals'),
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
    },
  },
  { ignores: ['.next/**', 'coverage/**', 'node_modules/**', 'e2e/**'] },
  eslintConfigPrettier,
);
```

- [ ] **Step 3: Add lint + format scripts**

In `package.json` `"scripts"`, add:

```json
"lint": "eslint .",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 4: Verify lint + format pass on the scaffold**

Run: `pnpm format && pnpm lint`
Expected: format rewrites files, lint exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: prettier + eslint strict-type-checked (bans any)"
```

---

## Task 4: Architecture enforcement (dependency-cruiser) + type-coverage + Knip

**Files:**

- Create: `boulder-coach/.dependency-cruiser.cjs`, `boulder-coach/knip.json`
- Create placeholder dirs: `boulder-coach/src/domain/`, `boulder-coach/src/data/`, `boulder-coach/src/app/lib/`

- [ ] **Step 1: Create the layer directories so rules have something to target**

```bash
mkdir -p src/domain src/data src/app/lib tests/domain
```

- [ ] **Step 2: Add the tools**

```bash
pnpm add -D dependency-cruiser type-coverage knip
```

- [ ] **Step 3: Create dependency-cruiser layering rules**

Create `.dependency-cruiser.cjs`:

```js
/** Enforces the layered architecture: domain is pure, data is the only storage seam. */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-pure',
      comment: 'src/domain must not import from data or app (no I/O, no UI).',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(data|app)' },
    },
    {
      name: 'data-not-from-app',
      comment: 'src/data (storage) must not depend on app/UI.',
      severity: 'error',
      from: { path: '^src/data' },
      to: { path: '^src/app' },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx'] },
  },
};
```

- [ ] **Step 4: Configure Knip**

Create `knip.json`:

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/app/**/{page,layout}.tsx", "src/app/**/route.ts"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": ["e2e/**", "tests/**"],
  "ignoreDependencies": ["@vitest/coverage-v8"]
}
```

- [ ] **Step 5: Add scripts**

In `package.json` `"scripts"`, add:

```json
"depcruise": "depcruise src --config .dependency-cruiser.cjs",
"type-coverage": "type-coverage --at-least 99 --strict --ignore-files \"e2e/**\"",
"knip": "knip"
```

- [ ] **Step 6: Verify all three pass on the (empty) scaffold**

Run: `pnpm depcruise && pnpm type-coverage`
Expected: depcruise reports "no dependency violations" (or "no modules" on empty src), type-coverage ≥ 99% — exit 0.
(Knip may warn until real entry files exist; we self-test it in Task 11.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: dependency-cruiser layering + type-coverage + knip"
```

---

## Task 5: The deterministic gate (`scripts/gate.sh`)

**Files:**

- Create: `boulder-coach/scripts/gate.sh`
- Modify: `boulder-coach/package.json`

- [ ] **Step 1: Write the gate script**

Create `scripts/gate.sh`:

```bash
#!/usr/bin/env bash
# THE deterministic gate — single source of truth, fast-to-slow so cheap failures surface first.
set -euo pipefail

echo "▶ 1/8 format"        && pnpm format:check
echo "▶ 2/8 lint"          && pnpm lint
echo "▶ 3/8 typecheck"     && pnpm exec tsc --noEmit
echo "▶ 4/8 architecture"  && pnpm depcruise
echo "▶ 5/8 type-coverage" && pnpm type-coverage
echo "▶ 6/8 tests+cov"     && pnpm exec vitest run --coverage
echo "▶ 7/8 dead-code"     && pnpm knip
echo "▶ 8/8 build"         && pnpm build

echo "✅ GATE PASSED"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/gate.sh
```

- [ ] **Step 3: Add the gate + test scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest",
"gate": "bash scripts/gate.sh"
```

- [ ] **Step 4: Run the gate on the clean scaffold**

Run: `pnpm gate`
Expected: all 8 steps pass (Vitest reports "no test files" which is exit 0 for `vitest run`), prints "✅ GATE PASSED", exit 0.

> If Knip fails on the empty scaffold because no entry files resolve, temporarily confirm with `pnpm knip --no-exit-code`; the real run is exercised in Task 11 once domain files exist.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(harness): deterministic gate.sh (single source of truth)"
```

---

## Task 6: Pre-commit + pre-push hooks (Husky v9 + lint-staged)

**Files:**

- Create: `boulder-coach/.husky/pre-commit`, `boulder-coach/.husky/pre-push`, `boulder-coach/.lintstagedrc.json`
- Modify: `boulder-coach/package.json`

- [ ] **Step 1: Install husky + lint-staged and init**

```bash
pnpm add -D husky lint-staged
pnpm exec husky init
```

Expected: `.husky/` created, `"prepare": "husky"` added to package.json scripts, a sample `.husky/pre-commit` created.

- [ ] **Step 2: Configure lint-staged (fast, staged-only)**

Create `.lintstagedrc.json`:

```json
{
  "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,css,md}": ["prettier --write"]
}
```

- [ ] **Step 3: Write the pre-commit hook**

Overwrite `.husky/pre-commit` (husky v9 hooks are plain shell — no boilerplate header):

```sh
pnpm exec lint-staged
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Write the pre-push hook (full gate)**

Create `.husky/pre-push`:

```sh
pnpm gate
```

Then: `chmod +x .husky/pre-push`

- [ ] **Step 5: Verify the pre-commit hook fires**

```bash
git add -A && git commit -m "feat(harness): husky pre-commit + pre-push hooks"
```

Expected: lint-staged + tsc run during the commit; commit succeeds.

---

## Task 7: CI/CD pipeline (GitHub Actions)

**Files:**

- Create: `boulder-coach/.github/workflows/ci.yml`

- [ ] **Step 1: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: boulder-coach
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: boulder-coach/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - name: Full gate
        run: pnpm gate
      - name: Semgrep static analysis
        run: |
          pnpm dlx semgrep --config=auto --error src
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium
      - name: E2E smoke
        run: pnpm exec playwright test
```

- [ ] **Step 2: Verify the YAML is well-formed**

Run: `pnpm dlx yaml-lint .github/workflows/ci.yml || node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')"`
Expected: no parse error (file readable / lint clean).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "ci: full gate + semgrep + playwright on push/PR"
```

---

## Task 8: Playwright smoke harness (placeholder-safe)

**Files:**

- Create: `boulder-coach/playwright.config.ts`, `boulder-coach/e2e/today.spec.ts`
- Modify: `boulder-coach/package.json`

> The real assertion lands once the Today screen exists (Plan 1 Task 10). Until then the spec asserts the app boots — a meaningful smoke test that never blocks on unbuilt UI.

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
```

- [ ] **Step 2: Configure Playwright with an auto-started dev server**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write the smoke spec**

Create `e2e/today.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('app boots and renders the root page', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page.locator('body')).toBeVisible();
});
```

- [ ] **Step 4: Add the e2e script**

In `package.json` `"scripts"`, add:

```json
"e2e": "playwright test"
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(e2e): playwright smoke harness (boot check)"
```

---

## Task 9: `.claude/settings.json` — Stop-gate hook + git deny rules

**Files:**

- Create: `boulder-coach/.claude/settings.json`

- [ ] **Step 1: Write the settings**

Create `.claude/settings.json`:

```json
{
  "permissions": {
    "deny": ["Bash(git push:*)", "Bash(git push)", "Bash(gh pr create:*)", "Bash(gh pr merge:*)"]
  },
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && pnpm gate >/tmp/gate.log 2>&1 || { echo 'BLOCKED: gate failing. See /tmp/gate.log. Fix before claiming done.'; exit 2; }"
          }
        ]
      }
    ]
  }
}
```

> The Stop hook blocks "done" claims while the gate is red (exit 2 = block). Push/PR are denied so a confused agent physically cannot send work remote — the user's "nothing leaves my machine" rule becomes config.

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(harness): Stop-gate hook + git push/PR deny rules"
```

---

## Task 10: `safety-rule-reviewer` agent

**Files:**

- Create: `boulder-coach/.claude/agents/safety-rule-reviewer.md`

- [ ] **Step 1: Write the agent definition**

Create `.claude/agents/safety-rule-reviewer.md`:

```markdown
---
name: safety-rule-reviewer
description: Reviews any change to src/domain/adaptation.ts or src/domain/loadMetrics.ts against the canonical injury-safety rule table. MUST be invoked after any edit to those files before the change is committed.
tools: Read, Grep, Glob, Bash
---

You are a safety reviewer for a bouldering training app. A wrong threshold can tell an injured
climber to load a damaged finger pulley or wrist. You verify the diff against the CANONICAL rules
below — not against what looks reasonable.

## Canonical rule table (source of truth)

Rules evaluate in PRIORITY ORDER (safety first). Verify the order is preserved:

1. **Sharp pain flag** (pip / wrist-tfcc / shoulder / elbow): cut main volume **50%**, force grip to
   open-hand, insert a prehab block, set `warmupMandatory = true`, return early. Reason must name the
   body part and suggest physio if persistent.
2. **Soreness (no sharp pain):** swap crimp/mixed grip → open-hand, intensity −1 notch (floor 5).
3. **ACWR > 1.5:** force deload — volume ~−40%, cap target RPE at 6, return early.
4. **ACWR 1.3–1.5 (inclusive of 1.3):** cap target RPE at 8, no new max attempts. Boundary is `>= 1.3`.
5. **High fatigue (>= 4) or poor sleep (<= 2):** volume −20%, target RPE −1 (floor 5).
6. **Crushing targets:** progress (+grade or +volume).
7. **Missing targets:** slight regress / more rest.
8. **Default:** deliver as planned, no changes.

## ACWR math (verify exactly)

- Daily load = `sessionRPE × durationMin`.
- Acute = 7-day rolling sum (age `< 7`, inclusive of today, exclude future `age < 0`).
- Chronic = 28-day load sum ÷ 4 (weekly-equivalent).
- ACWR = `acute / chronic`, **0 when chronic is 0**, rounded to 2 decimals.

## Your checklist (report PASS/FAIL per item with file:line evidence)

- [ ] Priority order intact (pain → soreness → acwr-high → acwr-caution → fatigue → progress → default).
- [ ] Pain branch does ALL of: 50% volume cut, open-hand, prehab inserted, `warmupMandatory=true`, early return.
- [ ] ACWR thresholds EXACTLY `> 1.5` and `>= 1.3` (off-by-one here is an injury risk).
- [ ] Every emitted change carries a non-empty human-readable `reason`.
- [ ] No rule weakens a safety test to pass it (compare against tests/domain/adaptation.test.ts).
- [ ] ACWR math matches the formulas above.

## Output

End with a single line: `SAFETY REVIEW: PASS` or `SAFETY REVIEW: FAIL — <one-line reason>`.
On FAIL, the loop must STOP and escalate to the human — do not auto-fix safety logic more than once.
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "const s=require('fs').readFileSync('.claude/agents/safety-rule-reviewer.md','utf8'); if(!s.startsWith('---')) throw new Error('no frontmatter'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(harness): safety-rule-reviewer agent"
```

---

## Task 11: `domain-rule-authoring` skill

**Files:**

- Create: `boulder-coach/.claude/skills/domain-rule-authoring/SKILL.md`

- [ ] **Step 1: Write the skill**

Create `.claude/skills/domain-rule-authoring/SKILL.md`:

```markdown
---
name: domain-rule-authoring
description: Use when implementing or editing src/domain/adaptation.ts or src/domain/loadMetrics.ts. Provides the canonical ACWR formulas and the 8-row safety rule table so rules are implemented from source, not paraphrase.
---

# Domain Rule Authoring

When you write the adaptation engine or load metrics, implement from THESE canonical definitions.
Do not paraphrase from memory — paraphrasing is the #1 logged failure mode.

## ACWR / load math

- Daily load = `sessionRPE × durationMin`.
- Acute = sum of loads with `0 <= ageDays < 7`.
- Chronic = (sum of loads with `0 <= ageDays < 28`) ÷ 4.
- ACWR = chronic === 0 ? 0 : round(acute / chronic, 2 decimals).
- Target band 0.8–1.3; `> 1.5` = force deload.

## Rule table (priority order — evaluate top-down, safety first)

| #   | Trigger                        | Action                                                                   |
| --- | ------------------------------ | ------------------------------------------------------------------------ |
| 1   | Sharp pain flag                | volume −50%, grip→open-hand, insert prehab, warmupMandatory=true, return |
| 2   | Soreness, no pain              | grip crimp/mixed→open-hand, RPE −1 (floor 5)                             |
| 3   | ACWR `> 1.5`                   | volume ~−40%, RPE cap 6, return                                          |
| 4   | ACWR `>= 1.3`                  | RPE cap 8, no new max                                                    |
| 5   | fatigue `>= 4` OR sleep `<= 2` | volume −20%, RPE −1 (floor 5)                                            |
| 6   | crushing targets               | progress +grade/+volume                                                  |
| 7   | missing targets                | regress / more rest                                                      |
| 8   | default                        | unchanged                                                                |

## Hard rules

- Threshold operators are EXACT: `> 1.5`, `>= 1.3`. Add a boundary test at exactly 1.3 and 1.5.
- Every change pushes an `{ ruleId, reason }` with a human-readable reason.
- The function is PURE: no I/O, no Date.now() inside (caller passes `asOf`). Clone before mutating.
- Never weaken a test to make it pass. If a test seems wrong, STOP and escalate.
```

- [ ] **Step 2: Verify it parses**

Run: `node -e "const s=require('fs').readFileSync('.claude/skills/domain-rule-authoring/SKILL.md','utf8'); if(!s.includes('name: domain-rule-authoring')) throw new Error('bad'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(harness): domain-rule-authoring skill"
```

---

## Task 12: `boulder-coach/CLAUDE.md` — encoded principles

**Files:**

- Create: `boulder-coach/CLAUDE.md`

- [ ] **Step 1: Write the project memory**

Create `CLAUDE.md`:

```markdown
# Boulder Coach — Project Instructions

## Architecture invariants (enforced by dependency-cruiser — do not violate)

- `src/domain/**` is PURE: no I/O, no storage, no React, no Date.now() inside functions (pass `asOf`).
- `src/domain` MUST NOT import from `src/data` or `src/app`.
- `src/data` MUST NOT import from `src/app`. `IClimbRepo` is the only storage seam.
- No circular dependencies.

## Quality bar (every task must pass `pnpm gate` before commit)

`pnpm gate` runs: format:check → lint → tsc --noEmit → depcruise → type-coverage → vitest+coverage → knip → build.

- NEVER use `any` (ESLint + type-coverage enforce this).
- Coverage: adaptation.ts & loadMetrics.ts = 100% branch; rest of domain ≥ 90% branch.
- TDD mandatory: write the failing test FIRST, watch it fail, then minimal impl, then refactor.
- Integration over unit tests where they catch more (drive the engine end-to-end).
- Test data must include a test/mock/dummy/example marker.

## Safety-critical files

Any edit to `src/domain/adaptation.ts` or `src/domain/loadMetrics.ts` MUST be reviewed by the
`safety-rule-reviewer` agent before commit. Use the `domain-rule-authoring` skill when writing them.

## Git policy

- Commit per task (conventional commits: `feat(domain): …`). Local commits are allowed.
- NEVER `git push` or `gh pr create` — denied by .claude/settings.json. Only the human pushes.

## Learning ledger

Before starting a task, grep `../docs/superpowers/LEARNINGS.md` for the file/module you're touching.
On any gate failure, append an entry (see ledger header for format). Fix from the lesson, not blind retry.

## YAGNI

Simplest solution that satisfies the spec + tests. No speculative abstraction.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md && git commit -m "docs: project CLAUDE.md (encoded principles)"
```

---

## Task 13: Learning ledger + the loop runbook

**Files:**

- Create: `docs/superpowers/LEARNINGS.md` (repo root, one level above boulder-coach)
- Create: `boulder-coach/.claude/LOOP.md`

- [ ] **Step 1: Create the ledger with header + format**

Create `docs/superpowers/LEARNINGS.md`:

```markdown
# Learnings Ledger

Append-only. Every gate failure, feedback-loop iteration, and safety escalation gets one entry.
Read-before-write: before a task, grep this file for the file/module you're touching.

## Entry format
```

## YYYY-MM-DD — <file> — <gate stage> (<test|type|lint|arch|coverage|safety>)

- **Task:** <which plan task>
- **What failed:** <symptom>
- **Root cause:** <why>
- **Fix:** <what changed>
- **Prevention:** <skill/rule/check update — or "promote to automated check" if 2nd occurrence>
- **Attempts to green:** <n>

```

## Promotion rule
When a failure category appears **≥ 2 times**, promote it into an automated check:
- repeated `any`/unsafe cast → stricter ESLint rule + type-coverage bump
- repeated layering violation → new dependency-cruiser rule
- repeated rule-table paraphrase → sharper domain-rule-authoring assertion
- repeated missed boundary → CLAUDE.md checklist line + required boundary test

---

<!-- entries below -->
```

- [ ] **Step 2: Document the loop protocol**

Create `boulder-coach/.claude/LOOP.md`:

```markdown
# Orchestration Loop Runbook (plan-agnostic)

Drives ANY plan in `docs/superpowers/plans/` task-by-task. Currently targets Plan 1
(`2026-06-09-bouldering-coach-core-engine.md`).

## Per-task protocol

1. Read the next `- [ ]` task. Grep LEARNINGS.md for the files it touches; include hits in the brief.
2. Dispatch a FRESH subagent (TDD: failing test → minimal impl → refactor).
3. Run `pnpm gate`. Exit code is law.
4. If a domain safety file changed → invoke `safety-rule-reviewer`. On FAIL: max 1 retry, then STOP + escalate.
5. On gate failure: append LEARNINGS.md entry, re-dispatch a fresh subagent with the EXACT failure
   output and "fix ONLY this, do not weaken tests". Retry up to N=3. Persistent → STOP + escalate.
6. `git add -A && git commit` (conventional message). NEVER push.
7. Next task.

## Parallelization map (Plan 1)

- Parallel-safe (no shared state): `loadMetrics` (Task 3), `warmup` (Task 4), `periodization` (Task 5
  depends on warmup types — run after warmup).
- Sequential: `adaptation` (Task 6, needs types) → repo (7–8) → bootstrap (9) → UI (10) → PWA (11).
- Use `superpowers:dispatching-parallel-agents` only for the parallel-safe set.

## Escalation = stop and ask the human. Never auto-fix safety logic past one retry.
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: learnings ledger + loop runbook"
cd .. && git add docs/superpowers/LEARNINGS.md
# Note: LEARNINGS.md is outside the boulder-coach git repo; if the repo root is boulder-coach,
# keep the ledger at boulder-coach/docs/LEARNINGS.md instead and update CLAUDE.md/LOOP.md paths.
```

> **Decision point for the executor:** if you want the ledger inside the gated repo, place it at
> `boulder-coach/docs/LEARNINGS.md` and adjust the two relative paths in CLAUDE.md and LOOP.md.
> Default assumption: ledger lives at the repo you commit to.

---

## Task 14: Prove every gate bites (harness self-tests)

> A gate you haven't watched fail is a gate you don't trust. Introduce each violation, confirm the
> gate FAILS, then revert. Do NOT commit the violations.

**Files:**

- Temporary edits only (all reverted)

- [ ] **Step 1: Seed a minimal real test so coverage/knip have something to chew**

Create `tests/domain/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('harness smoke', () => {
  it('runs the test runner', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test` → Expected: PASS (1 test). Commit:

```bash
git add tests/domain/smoke.test.ts && git commit -m "test: harness smoke test"
```

- [ ] **Step 2: `any` violation fails lint**

Create `src/domain/_probe.ts` with: `export const x: any = 1;`
Run: `pnpm lint` → Expected: FAIL on `no-explicit-any`. Then delete the file:

```bash
rm src/domain/_probe.ts
```

- [ ] **Step 3: Layering violation fails depcruise**

Create `src/domain/_probe.ts`:

```ts
import { DexieClimbRepo } from '../data/dexieRepo';
export const y = DexieClimbRepo;
```

(create an empty `src/data/dexieRepo.ts` exporting `export const DexieClimbRepo = class {};` if needed)
Run: `pnpm depcruise` → Expected: FAIL on `domain-stays-pure`. Then revert:

```bash
rm src/domain/_probe.ts src/data/dexieRepo.ts 2>/dev/null || true
```

- [ ] **Step 4: Formatting violation fails format:check**

Create `src/domain/_probe.ts` with badly formatted code: `export const z=    1`
Run: `pnpm format:check` → Expected: FAIL. Revert: `rm src/domain/_probe.ts`

- [ ] **Step 5: Failing test fails the gate**

Append to `tests/domain/smoke.test.ts`: `it('fails on purpose', () => expect(true).toBe(false));`
Run: `pnpm test` → Expected: FAIL. Then remove that line (restore the file to Step 1 content).

- [ ] **Step 6: Confirm the full gate is green again**

Run: `pnpm gate`
Expected: "✅ GATE PASSED", exit 0.

- [ ] **Step 7: Record the self-test result in the ledger**

Append to `docs/superpowers/LEARNINGS.md` (or `boulder-coach/docs/LEARNINGS.md`):

```markdown
## 2026-06-09 — harness — self-test

- **Task:** Task 14
- **What failed:** N/A — verification run.
- **Root cause:** N/A.
- **Fix:** Confirmed gate fails on: any, layering, formatting, failing test. Gate green afterward.
- **Prevention:** Gates verified to bite before releasing the loop.
- **Attempts to green:** 1
```

Commit:

```bash
git add -A && git commit -m "test(harness): verify every gate fails on its violation"
```

---

## Task 15: Release the loop on Plan 1

**Files:**

- None (execution handoff)

- [ ] **Step 1: Confirm preconditions**

Run: `pnpm gate`
Expected: green. Control plane complete: CLAUDE.md, settings.json, safety-rule-reviewer, domain-rule-authoring, husky hooks, CI, ledger, LOOP.md all present.

- [ ] **Step 2: Hand off to the autonomous loop**

Invoke `superpowers:subagent-driven-development` to execute Plan 1
(`docs/superpowers/plans/2026-06-09-bouldering-coach-core-engine.md`) Tasks 2–11, following
`.claude/LOOP.md`:

- Plan 1 Task 1 (scaffold) is already done by this harness — skip it.
- Each Plan 1 task: fresh subagent → `pnpm gate` → safety review on domain files → ledger on failure →
  feedback retry ≤3 → commit. Never push.

- [ ] **Step 3: Final verification**

Run: `pnpm gate`
Expected: all Plan 1 domain suites green (loadMetrics, warmup, periodization, adaptation, dexieRepo,
bootstrap), coverage thresholds met, build succeeds. Today screen renders (Playwright smoke green).

---

## Self-Review

**Spec coverage:**

- Loop engine = subagent-driven-development → Task 15 ✅
- Per-task gates → `gate.sh` (Task 5) + Stop hook (Task 9) ✅
- Git auto-commit local / push denied → settings.json (Task 9) + commits throughout ✅
- CI/CD → Task 7 ✅
- Pre-commit + pre-push → Task 6 ✅
- TDD enforced → CLAUDE.md mandate (Task 12) + per-task TDD steps in Plan 1 ✅
- Production-ready → `pnpm build` in gate (Task 5) ✅
- Static analysis (TS strict, ESLint strict-type-checked, dependency-cruiser, type-coverage, Knip, Semgrep) → Tasks 2,3,4,5,7 ✅
- Dynamic analysis (Vitest+coverage, Playwright) → Tasks 2,8 ✅
- Linting / standard code → Task 3 ✅
- Design principles / system design enforced → dependency-cruiser (Task 4) + CLAUDE.md (Task 12) ✅
- Loopback feedback to agents → LOOP.md protocol (Task 13) + Task 15 ✅
- Learning ledger + promotion → Task 13 + Task 14 ledger entries ✅
- Scalability (plan-agnostic loop, parallel map, workspace-ready) → LOOP.md (Task 13) ✅
- Safety-rule reviewer → Task 10 ✅

**Placeholder scan:** Every config/code step contains full content. The one intentional executor
decision (ledger location) is called out explicitly with both options, not left vague. ✅

**Type/name consistency:** `pnpm gate` script name consistent across gate.sh, package.json, husky
pre-push, settings.json Stop hook, CI, CLAUDE.md, LOOP.md. Layer paths (`src/domain`, `src/data`,
`src/app`) consistent across dependency-cruiser, CLAUDE.md, and Plan 1's file structure. Coverage
target files (`adaptation.ts`, `loadMetrics.ts`) consistent across vitest.config, safety-reviewer,
and CLAUDE.md. ✅

```

```
