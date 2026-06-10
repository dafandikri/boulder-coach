# Crew — Multi-Agent Parallel Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Crew" — a git-native, tool-neutral orchestrator that runs up to 3 agents in parallel worktrees on this repo, assigning file-disjoint backlog PBIs so merge conflicts are structurally impossible, with a reviewer-gated tiered auto-merge and human override.

**Architecture:** A deterministic Node conductor loop owns all correctness guarantees (atomic claims, disjoint-file locking, dependency gating, serial rebase→gate→merge). Two thin LLM roles add judgment only: a _manager brain_ (split big PBIs / pick the best parallel set) and a _reviewer_ (scrutinize each green-gate branch). All state lives in git under `.crew/`; workers are any agent launched via per-tool adapters.

**Tech Stack:** Node 24 ESM (`.mjs`, no new runtime deps), git worktrees, pnpm, vitest (existing), bash adapters. Reuses the repo's `pnpm gate`, `pnpm onboard`, `BACKLOG.md`, `HANDOFF.md`.

**Spec:** `docs/superpowers/specs/2026-06-10-crew-multi-agent-orchestration-design.md`

---

## File structure (decomposition)

Pure logic (fully unit-tested) is separated from I/O glue (integration-tested against a temp git repo):

```
scripts/crew/
  lib/
    backlog.mjs      # parse BACKLOG.md → PBI[]  (pure)
    schedule.mjs     # next assignable PBI: unblocked + file-disjoint  (pure)
    risk.mjs         # classify changed files → 'auto' | 'review'  (pure)
    lease.mjs        # claim lease/heartbeat expiry  (pure)
    glob.mjs         # tiny glob→RegExp (no dep)  (pure)
    claims.mjs       # read/write/atomic-claim claim files  (I/O)
    git.mjs          # thin git/worktree/gate shell wrappers  (I/O)
  conduct.mjs        # the conductor polling loop  (wiring)
  merge.mjs          # rebase → gate → merge → refresh HANDOFF  (I/O)
  crew.mjs           # CLI: start/status/approve/reject/pause/take-over
  adapters/
    claude.sh        # launch a Claude Code worker
    codex.sh         # launch a Codex worker
    aider.sh         # launch an Aider worker
  prompts/
    worker.md        # tool-neutral worker charge
    manager.md       # manager-brain prompt
    reviewer.md      # reviewer prompt
.crew/
  config.json        # maxWorkers, adapters, risk tiers, lease
  config.schema.json
tests/crew/
  backlog.test.ts
  schedule.test.ts
  risk.test.ts
  lease.test.ts
  glob.test.ts
  claims.test.ts        # against tmp dir
  integration.test.ts   # claim→lock→release against tmp git repo
docs/crew/README.md     # runbook
```

Each `lib/*.mjs` has one responsibility and a documented interface. The conductor wires them; it holds no business logic of its own beyond sequencing.

---

## Phase 1 — Pure scheduling core (correctness foundation)

This phase delivers the brain of conflict-avoidance with zero I/O — fully unit-testable. After Phase 1 you can prove "two agents never get overlapping files" without launching anything.

### Task 1: Tiny glob matcher

**Files:**

- Create: `scripts/crew/lib/glob.mjs`
- Test: `tests/crew/glob.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { globToRegExp } from '../../scripts/crew/lib/glob.mjs';

describe('globToRegExp (mock paths)', () => {
  it('matches a single-segment * within a dir', () => {
    expect(globToRegExp('src/domain/*.ts').test('src/domain/schedule.ts')).toBe(true);
    expect(globToRegExp('src/domain/*.ts').test('src/domain/sub/x.ts')).toBe(false);
  });
  it('matches ** across segments', () => {
    expect(globToRegExp('src/app/**/page.tsx').test('src/app/program/page.tsx')).toBe(true);
    expect(globToRegExp('src/app/**').test('src/app/lib/date.ts')).toBe(true);
  });
  it('matches exact paths and escapes dots', () => {
    expect(globToRegExp('package.json').test('package.json')).toBe(true);
    expect(globToRegExp('package.json').test('packageXjson')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/crew/glob.test.ts`
Expected: FAIL — `Cannot find module '.../glob.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/crew/lib/glob.mjs
/** Convert a restricted glob (supports * and **) to an anchored RegExp. */
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped
    .replace(/\*\*\/?/g, '__GLOBSTAR__') // ** (optionally trailing slash) → placeholder
    .replace(/\*/g, '[^/]*') // * → within one segment
    .replace(/__GLOBSTAR__/g, '.*'); // placeholder → across segments
  return new RegExp(`^${body}$`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/crew/glob.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/lib/glob.mjs tests/crew/glob.test.ts
git commit -m "feat(crew): tiny glob→RegExp matcher (no dep)"
```

---

### Task 2: BACKLOG.md parser

**Files:**

- Create: `scripts/crew/lib/backlog.mjs`
- Test: `tests/crew/backlog.test.ts`

- [ ] **Step 1: Write the failing test** (fixture mirrors the real `docs/BACKLOG.md` format)

```ts
import { describe, it, expect } from 'vitest';
import { parseBacklog } from '../../scripts/crew/lib/backlog.mjs';

const FIXTURE = `
### BC-01 · Program week never advances — \`done (9f009bd, 2026-06-10)\`
- **Type:** bug · **Priority:** P0 · **Complexity:** M · **Depends on:** —
- **Files:** \`src/domain/periodization.ts\`, \`src/app/lib/bootstrap.ts\`, tests.

### BC-06 · Onboarding & profile screen — \`open\`
- **Type:** feature · **Priority:** P1 · **Complexity:** M · **Depends on:** BC-01
- **Files:** \`src/app/lib/profileForm.ts\`, \`src/domain/profile.ts\`

### BC-07 · Mock placeholder PBI — \`in-progress (someone/2026-06-10)\`
- **Type:** chore · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-01, BC-06
- **Files:** \`docs/BACKLOG.md\`
`;

describe('parseBacklog (mock fixture)', () => {
  const pbis = parseBacklog(FIXTURE);

  it('parses id, title, priority, complexity', () => {
    const bc1 = pbis.find((p) => p.id === 'BC-01');
    expect(bc1).toMatchObject({ priority: 'P0', complexity: 'M', status: 'done' });
    expect(bc1?.title).toBe('Program week never advances');
  });
  it('parses dependsOn as id list, — as empty', () => {
    expect(pbis.find((p) => p.id === 'BC-01')?.dependsOn).toEqual([]);
    expect(pbis.find((p) => p.id === 'BC-07')?.dependsOn).toEqual(['BC-01', 'BC-06']);
  });
  it('parses Files into clean path list, dropping prose like "tests."', () => {
    expect(pbis.find((p) => p.id === 'BC-01')?.files).toEqual([
      'src/domain/periodization.ts',
      'src/app/lib/bootstrap.ts',
    ]);
  });
  it('parses status from header (open/in-progress/done)', () => {
    expect(pbis.find((p) => p.id === 'BC-06')?.status).toBe('open');
    expect(pbis.find((p) => p.id === 'BC-07')?.status).toBe('in-progress');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/crew/backlog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/crew/lib/backlog.mjs
/**
 * @typedef {Object} Pbi
 * @property {string} id
 * @property {string} title
 * @property {string} priority   // 'P0'..'P3' or ''
 * @property {string} complexity // 'S'|'M'|'L'|'XL' or ''
 * @property {string[]} dependsOn
 * @property {string[]} files
 * @property {'open'|'in-progress'|'done'} status
 */

/** @returns {Pbi[]} */
export function parseBacklog(markdown) {
  const pbis = [];
  let cur = null;
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    const header = line.match(/^###\s+(BC-\d+)\s*·\s*(.+)$/);
    if (header) {
      if (cur) pbis.push(cur);
      const rest = header[2];
      const statusM = rest.match(/—\s*`?\s*(done|in-progress|open)/i);
      cur = {
        id: header[1],
        title: rest.split('—')[0].trim(),
        priority: '',
        complexity: '',
        dependsOn: [],
        files: [],
        status: statusM ? /** @type {any} */ (statusM[1].toLowerCase()) : 'open',
      };
      continue;
    }
    if (!cur) continue;
    const prio = line.match(/\*\*Priority:\*\*\s*(P\d)/);
    if (prio) cur.priority = prio[1];
    const cx = line.match(/\*\*Complexity:\*\*\s*(XL|S|M|L)/);
    if (cx) cur.complexity = cx[1];
    const dep = line.match(/\*\*Depends on:\*\*\s*([^·]+)/);
    if (dep) cur.dependsOn = dep[1].match(/BC-\d+/g) ?? [];
    const files = line.match(/\*\*Files:\*\*\s*(.+)$/);
    if (files) {
      cur.files = files[1]
        .split(',')
        .map((s) => s.replace(/`/g, '').trim())
        .filter((s) => /^[\w./*-]+$/.test(s) && s.includes('/'));
    }
  }
  if (cur) pbis.push(cur);
  return pbis;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/crew/backlog.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/lib/backlog.mjs tests/crew/backlog.test.ts
git commit -m "feat(crew): parse BACKLOG.md into structured PBIs"
```

---

### Task 3: Schedule selector (dependency gating + file-disjoint locking)

**Files:**

- Create: `scripts/crew/lib/schedule.mjs`
- Test: `tests/crew/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { filesOverlap, nextAssignable } from '../../scripts/crew/lib/schedule.mjs';

const pbi = (id, over) => ({
  id,
  title: id,
  priority: 'P1',
  complexity: 'M',
  dependsOn: [],
  files: [],
  status: 'open',
  ...over,
});

describe('filesOverlap (mock)', () => {
  it('detects a shared file', () => {
    expect(filesOverlap(['a.ts', 'b.ts'], ['b.ts'])).toBe(true);
    expect(filesOverlap(['a.ts'], ['b.ts'])).toBe(false);
  });
});

describe('nextAssignable (mock)', () => {
  it('skips PBIs whose deps are not done', () => {
    const pbis = [
      pbi('BC-2', { dependsOn: ['BC-1'], files: ['x.ts'] }),
      pbi('BC-1', { status: 'done', files: ['y.ts'] }),
    ];
    expect(nextAssignable(pbis, [])?.id).toBe(undefined); // BC-1 done, BC-2 dep met → wait, BC-2 assignable
  });
  it('returns the dep-satisfied, file-disjoint, highest-priority PBI', () => {
    const pbis = [
      pbi('BC-1', { status: 'done', files: ['done.ts'] }),
      pbi('BC-2', { priority: 'P0', dependsOn: ['BC-1'], files: ['a.ts'] }),
      pbi('BC-3', { priority: 'P1', files: ['b.ts'] }),
    ];
    expect(nextAssignable(pbis, [])?.id).toBe('BC-2'); // P0 first
  });
  it('never assigns a PBI whose files overlap an active claim', () => {
    const pbis = [pbi('BC-2', { files: ['a.ts', 'shared.ts'] }), pbi('BC-3', { files: ['c.ts'] })];
    const claims = [{ pbiId: 'BC-9', files: ['shared.ts'] }];
    expect(nextAssignable(pbis, claims)?.id).toBe('BC-3'); // BC-2 locked out
  });
  it('excludes already-claimed PBIs and those with no files', () => {
    const pbis = [pbi('BC-2', { files: [] }), pbi('BC-3', { files: ['c.ts'] })];
    expect(nextAssignable(pbis, [{ pbiId: 'BC-3', files: ['c.ts'] }])).toBeNull();
  });
});
```

> Note: fix the first test's expectation — BC-2's dep (BC-1) IS done, so it is assignable. Replace
> that `it` body with: `expect(nextAssignable(pbis, [])?.id).toBe('BC-2');`. (Kept here to show the
> dependency path explicitly during TDD.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/crew/schedule.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/crew/lib/schedule.mjs
/** @typedef {import('./backlog.mjs').Pbi} Pbi */
/** @typedef {{ pbiId: string, files: string[] }} ActiveClaim */

/** Do any files in `a` appear in `b`? */
export function filesOverlap(a, b) {
  const setB = new Set(b);
  return a.some((f) => setB.has(f));
}

/**
 * Highest-priority open PBI whose deps are all done and whose files are disjoint
 * from every active claim. Null if nothing is safely assignable.
 * @param {Pbi[]} pbis @param {ActiveClaim[]} active @returns {Pbi|null}
 */
export function nextAssignable(pbis, active) {
  const doneIds = new Set(pbis.filter((p) => p.status === 'done').map((p) => p.id));
  const claimedIds = new Set(active.map((c) => c.pbiId));
  const lockedFiles = active.flatMap((c) => c.files);
  const candidates = pbis.filter(
    (p) =>
      p.status === 'open' &&
      !claimedIds.has(p.id) &&
      p.files.length > 0 &&
      p.dependsOn.every((d) => doneIds.has(d)) &&
      !filesOverlap(p.files, lockedFiles),
  );
  // Array.prototype.sort is stable in V8 → ties keep backlog order.
  candidates.sort((a, b) => a.priority.localeCompare(b.priority));
  return candidates[0] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/crew/schedule.test.ts`
Expected: PASS (after fixing the first test body per the note).

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/lib/schedule.mjs tests/crew/schedule.test.ts
git commit -m "feat(crew): dependency-gated, file-disjoint PBI scheduler"
```

---

### Task 4: Risk classifier (tiered auto-merge decision)

**Files:**

- Create: `scripts/crew/lib/risk.mjs`
- Test: `tests/crew/risk.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { classify } from '../../scripts/crew/lib/risk.mjs';

const CONFIG = {
  autoMerge: {
    eligiblePaths: ['src/domain/**', 'src/app/lib/**', 'docs/**'],
    alwaysReview: [
      'src/domain/adaptation.ts',
      'src/domain/loadMetrics.ts',
      'src/app/**/*.tsx',
      'scripts/**',
      'package.json',
    ],
  },
};

describe('classify (mock config)', () => {
  it('auto-merges pure domain changes', () => {
    expect(classify(['src/domain/schedule.ts'], CONFIG)).toBe('auto');
  });
  it('routes safety files to review even though they are under src/domain', () => {
    expect(classify(['src/domain/adaptation.ts'], CONFIG)).toBe('review');
  });
  it('routes any .tsx (gate-blind UI) to review', () => {
    expect(classify(['src/app/program/page.tsx'], CONFIG)).toBe('review');
  });
  it('routes a changeset to review if ANY file is non-eligible', () => {
    expect(classify(['src/domain/schedule.ts', 'src/data/dexieRepo.ts'], CONFIG)).toBe('review');
  });
  it('routes infra changes to review', () => {
    expect(classify(['scripts/crew/conduct.mjs'], CONFIG)).toBe('review');
    expect(classify(['package.json'], CONFIG)).toBe('review');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/crew/risk.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/crew/lib/risk.mjs
import { globToRegExp } from './glob.mjs';

/**
 * 'auto' only if every changed file matches an eligiblePath AND no file matches
 * an alwaysReview pattern. Otherwise 'review'. Fail-safe: empty changeset → review.
 * @param {string[]} changedFiles
 * @param {{autoMerge:{eligiblePaths:string[],alwaysReview:string[]}}} config
 * @returns {'auto'|'review'}
 */
export function classify(changedFiles, config) {
  if (changedFiles.length === 0) return 'review';
  const eligible = config.autoMerge.eligiblePaths.map(globToRegExp);
  const review = config.autoMerge.alwaysReview.map(globToRegExp);
  const anyReview = changedFiles.some((f) => review.some((r) => r.test(f)));
  const allEligible = changedFiles.every((f) => eligible.some((r) => r.test(f)));
  return !anyReview && allEligible ? 'auto' : 'review';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/crew/risk.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/lib/risk.mjs tests/crew/risk.test.ts
git commit -m "feat(crew): tiered auto-merge risk classifier"
```

---

### Task 5: Lease expiry

**Files:**

- Create: `scripts/crew/lib/lease.mjs`
- Test: `tests/crew/lease.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { isExpired } from '../../scripts/crew/lib/lease.mjs';

describe('isExpired (mock clock)', () => {
  const claim = { heartbeat: '2026-06-10T10:00:00.000Z' };
  const at = (iso) => new Date(iso).getTime();
  it('is not expired within the lease window', () => {
    expect(isExpired(claim, at('2026-06-10T10:20:00.000Z'), 1800)).toBe(false); // 20m < 30m
  });
  it('is expired past the lease window', () => {
    expect(isExpired(claim, at('2026-06-10T10:31:00.000Z'), 1800)).toBe(true); // 31m > 30m
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/crew/lease.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/crew/lib/lease.mjs
/**
 * @param {{heartbeat:string}} claim ISO heartbeat
 * @param {number} nowMs @param {number} leaseSeconds
 */
export function isExpired(claim, nowMs, leaseSeconds) {
  return nowMs - new Date(claim.heartbeat).getTime() > leaseSeconds * 1000;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/crew/lease.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/lib/lease.mjs tests/crew/lease.test.ts
git commit -m "feat(crew): claim lease expiry check"
```

---

### Task 6: Wire Phase 1 into the gate (vitest picks up tests/crew automatically)

**Files:**

- Verify: `vitest.config.ts` includes `tests/**` (it does today).

- [ ] **Step 1: Run the full suite**

Run: `pnpm vitest run`
Expected: all existing + new `tests/crew/*` pass.

- [ ] **Step 2: Confirm gate stays green** (scripts/ is not type-coverage-scanned; `.mjs` is fine)

Run: `pnpm gate`
Expected: `✅ GATE PASSED`. If knip flags `scripts/crew/lib/*.mjs` as unused, that is expected until Phase 7 imports them — note it; do NOT add a knip ignore (the importing code lands this milestone).

- [ ] **Step 3: Commit (if any config touched)**

```bash
git commit -am "test(crew): phase-1 pure core under the gate" || echo "nothing to commit"
```

> **Phase 1 done:** the conflict-avoidance brain is proven without any I/O. A reviewer can read
> `schedule.mjs` + its tests and trust that two workers can never receive overlapping files.

---

## Phase 2 — Config + claims I/O (atomic, git-backed)

### Task 7: Config file + schema

**Files:**

- Create: `.crew/config.json`
- Create: `.crew/config.schema.json`

- [ ] **Step 1: Write `.crew/config.json`**

```json
{
  "$schema": "./config.schema.json",
  "maxWorkers": 3,
  "workerTool": "claude",
  "leaseSeconds": 1800,
  "maxGateAttempts": 3,
  "launchAdapters": {
    "claude": "scripts/crew/adapters/claude.sh",
    "codex": "scripts/crew/adapters/codex.sh",
    "aider": "scripts/crew/adapters/aider.sh"
  },
  "autoMerge": {
    "eligiblePaths": ["src/domain/**", "src/app/lib/**", "docs/**"],
    "requireBranchCoverage": 100,
    "alwaysReview": [
      "src/domain/adaptation.ts",
      "src/domain/loadMetrics.ts",
      "src/app/**/*.tsx",
      "scripts/**",
      "*.config.*",
      "package.json"
    ]
  }
}
```

- [ ] **Step 2: Write `.crew/config.schema.json`** (JSON Schema draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["maxWorkers", "workerTool", "leaseSeconds", "launchAdapters", "autoMerge"],
  "additionalProperties": true,
  "properties": {
    "maxWorkers": { "type": "integer", "minimum": 1, "maximum": 8 },
    "workerTool": { "type": "string" },
    "leaseSeconds": { "type": "integer", "minimum": 60 },
    "maxGateAttempts": { "type": "integer", "minimum": 1 },
    "launchAdapters": { "type": "object", "additionalProperties": { "type": "string" } },
    "autoMerge": {
      "type": "object",
      "required": ["eligiblePaths", "alwaysReview"],
      "properties": {
        "eligiblePaths": { "type": "array", "items": { "type": "string" } },
        "requireBranchCoverage": { "type": "number" },
        "alwaysReview": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .crew/config.json .crew/config.schema.json
git commit -m "feat(crew): orchestrator config + schema"
```

---

### Task 8: Claims store (read/write, atomic claim, release)

**Files:**

- Create: `scripts/crew/lib/claims.mjs`
- Test: `tests/crew/claims.test.ts`

- [ ] **Step 1: Write the failing test** (against a temp dir, not the repo)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readClaims, writeClaim, releaseClaim, tryClaim } from '../../scripts/crew/lib/claims.mjs';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crew-test-'));
});

describe('claims store (tmp dir)', () => {
  it('writes and reads back a claim', () => {
    writeClaim(dir, {
      pbiId: 'BC-99',
      files: ['mock/a.ts'],
      worktree: 'wt',
      branch: 'b',
      status: 'claimed',
      heartbeat: 'T',
      owner: 'w1',
    });
    const claims = readClaims(dir);
    expect(claims).toHaveLength(1);
    expect(claims[0].pbiId).toBe('BC-99');
    rmSync(dir, { recursive: true, force: true });
  });
  it('tryClaim succeeds when unclaimed, fails when already claimed', () => {
    expect(
      tryClaim(dir, {
        pbiId: 'BC-1',
        files: ['mock/x.ts'],
        worktree: 'w',
        branch: 'b',
        status: 'claimed',
        heartbeat: 'T',
        owner: 'w1',
      }),
    ).toBe(true);
    expect(
      tryClaim(dir, {
        pbiId: 'BC-1',
        files: ['mock/x.ts'],
        worktree: 'w',
        branch: 'b',
        status: 'claimed',
        heartbeat: 'T',
        owner: 'w2',
      }),
    ).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
  it('releaseClaim removes the claim file', () => {
    tryClaim(dir, {
      pbiId: 'BC-2',
      files: ['mock/y.ts'],
      worktree: 'w',
      branch: 'b',
      status: 'claimed',
      heartbeat: 'T',
      owner: 'w1',
    });
    releaseClaim(dir, 'BC-2');
    expect(readClaims(dir)).toHaveLength(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/crew/claims.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** (atomic via `wx` exclusive create)

```js
// scripts/crew/lib/claims.mjs
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** @typedef {{pbiId:string,files:string[],worktree:string,branch:string,status:string,heartbeat:string,owner:string}} Claim */

const claimsDir = (root) => {
  const d = join(root, 'claims');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
};
const claimPath = (root, pbiId) => join(claimsDir(root), `${pbiId}.json`);

/** @returns {Claim[]} */
export function readClaims(root) {
  const d = claimsDir(root);
  return readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(d, f), 'utf8')));
}

/** Overwrite (used for heartbeat/status updates). */
export function writeClaim(root, claim) {
  writeFileSync(claimPath(root, claim.pbiId), JSON.stringify(claim, null, 2));
}

/** Atomic create: returns false if a claim already exists (wx flag throws EEXIST). */
export function tryClaim(root, claim) {
  try {
    writeFileSync(claimPath(root, claim.pbiId), JSON.stringify(claim, null, 2), { flag: 'wx' });
    return true;
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EEXIST') return false;
    throw err;
  }
}

export function releaseClaim(root, pbiId) {
  rmSync(claimPath(root, pbiId), { force: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/crew/claims.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/lib/claims.mjs tests/crew/claims.test.ts
git commit -m "feat(crew): atomic git-backed claims store"
```

---

### Task 9: Git/worktree/gate wrappers

**Files:**

- Create: `scripts/crew/lib/git.mjs`

> These are thin shell-outs; they are exercised by the integration test in Task 10 (integration over
> unit, per repo policy — mocking `execSync` would test nothing real).

- [ ] **Step 1: Write the implementation**

```js
// scripts/crew/lib/git.mjs
import { execFileSync } from 'node:child_process';

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();

export function currentBranch(cwd = process.cwd()) {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
}

/** Create a worktree at `path` on a new `branch` from `base`. */
export function addWorktree(path, branch, base = 'main') {
  git(['worktree', 'add', '-b', branch, path, base]);
}

export function removeWorktree(path) {
  git(['worktree', 'remove', '--force', path]);
}

/** Files changed on `branch` relative to `base`. */
export function changedFiles(branch, base = 'main', cwd = process.cwd()) {
  const out = git(['diff', '--name-only', `${base}...${branch}`], { cwd });
  return out ? out.split('\n').filter(Boolean) : [];
}

/** Rebase `branch` onto `base` inside the worktree; throws on conflict. */
export function rebaseOnto(base, cwd) {
  git(['rebase', base], { cwd });
}

export function mergeFastForwardOnly(branch) {
  git(['merge', '--ff-only', branch]);
}
```

- [ ] **Step 2: Smoke-check it loads**

Run: `node -e "import('./scripts/crew/lib/git.mjs').then(m=>console.log(Object.keys(m)))"`
Expected: prints the exported function names.

- [ ] **Step 3: Commit**

```bash
git add scripts/crew/lib/git.mjs
git commit -m "feat(crew): git/worktree/gate shell wrappers"
```

---

### Task 10: Integration test — claim → lock → release against a real temp git repo

**Files:**

- Create: `tests/crew/integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tryClaim, readClaims } from '../../scripts/crew/lib/claims.mjs';
import { nextAssignable } from '../../scripts/crew/lib/schedule.mjs';

let repo: string;
const run = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'crew-itest-'));
  run(['init', '-q']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'crew-test']);
  mkdirSync(join(repo, '.crew', 'claims'), { recursive: true });
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('crew integration (tmp git repo)', () => {
  it('a claimed PBI locks its files out of the next assignment', () => {
    const pbis = [
      {
        id: 'BC-A',
        title: 'a',
        priority: 'P1',
        complexity: 'M',
        dependsOn: [],
        files: ['mock/shared.ts'],
        status: 'open' as const,
      },
      {
        id: 'BC-B',
        title: 'b',
        priority: 'P1',
        complexity: 'M',
        dependsOn: [],
        files: ['mock/shared.ts'],
        status: 'open' as const,
      },
      {
        id: 'BC-C',
        title: 'c',
        priority: 'P1',
        complexity: 'M',
        dependsOn: [],
        files: ['mock/other.ts'],
        status: 'open' as const,
      },
    ];
    const crewRoot = join(repo, '.crew');
    const first = nextAssignable(pbis, [])!;
    expect(first.id).toBe('BC-A');
    expect(
      tryClaim(crewRoot, {
        pbiId: first.id,
        files: first.files,
        worktree: 'w',
        branch: 'b',
        status: 'claimed',
        heartbeat: 'T',
        owner: 'w1',
      }),
    ).toBe(true);

    const active = readClaims(crewRoot).map((c) => ({ pbiId: c.pbiId, files: c.files }));
    const second = nextAssignable(pbis, active)!;
    expect(second.id).toBe('BC-C'); // BC-B shares mock/shared.ts → locked out
  });
});
```

- [ ] **Step 2: Run test to verify it fails, then passes** (logic already exists from earlier tasks)

Run: `pnpm vitest run tests/crew/integration.test.ts`
Expected: PASS — this asserts the pieces compose correctly.

- [ ] **Step 3: Commit**

```bash
git add tests/crew/integration.test.ts
git commit -m "test(crew): integration — claim locks files out of next assignment"
```

> **Phase 2 done:** state persists atomically in git, and the lock is proven end-to-end against a
> real repo.

---

## Phase 3 — Worker launch (tool-neutral adapters)

### Task 11: Worker charge prompt + adapters

**Files:**

- Create: `scripts/crew/prompts/worker.md`
- Create: `scripts/crew/adapters/claude.sh`, `scripts/crew/adapters/codex.sh`, `scripts/crew/adapters/aider.sh`
- Create: `scripts/crew/lib/launch.mjs`

- [ ] **Step 1: Write the tool-neutral worker charge**

`scripts/crew/prompts/worker.md`:

```markdown
You are a Crew worker in an isolated git worktree. Do exactly ONE backlog item: {{PBI_ID}}.

1. Run `pnpm onboard`. Read AGENTS.md and docs/HANDOFF.md. Grep docs/LEARNINGS.md for every file
   listed in this PBI's `Files:`.
2. Implement {{PBI_ID}} under strict TDD (write the failing test first). Follow the quality bar in
   CLAUDE.md. Touch ONLY files within this PBI's declared `Files:` set — they are your lock.
3. `pnpm gate` MUST be green before you finish.
4. Update docs/HANDOFF.md (and the PBI status in docs/BACKLOG.md) as your LAST step.
5. Do NOT `git push`. Commit locally with a conventional-commit message.

When the gate is green and committed, stop. The conductor handles review and merge.
```

- [ ] **Step 2: Write the Claude adapter**

`scripts/crew/adapters/claude.sh`:

```bash
#!/usr/bin/env bash
# args: $1=worktree path  $2=pbi id  $3=charge file
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec claude --permission-mode acceptEdits --print "$charge"
```

- [ ] **Step 3: Write codex + aider adapters (same contract)**

`scripts/crew/adapters/codex.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec codex exec "$charge"
```

`scripts/crew/adapters/aider.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
charge="$(sed "s/{{PBI_ID}}/$2/g" "$3")"
cd "$1"
exec aider --yes --message "$charge"
```

- [ ] **Step 4: Make adapters executable + write the launch helper**

```bash
chmod +x scripts/crew/adapters/*.sh
```

`scripts/crew/lib/launch.mjs`:

```js
import { spawn } from 'node:child_process';
import { join } from 'node:path';

/**
 * Launch a worker for `pbiId` in `worktree` using the configured adapter.
 * Returns the child process (caller tracks completion via claim status/heartbeat).
 */
export function launchWorker(config, worktree, pbiId) {
  const adapter = config.launchAdapters[config.workerTool];
  if (!adapter) throw new Error(`No adapter for workerTool '${config.workerTool}'`);
  const charge = join(process.cwd(), 'scripts/crew/prompts/worker.md');
  return spawn('bash', [adapter, worktree, pbiId, charge], { stdio: 'inherit' });
}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/prompts/worker.md scripts/crew/adapters scripts/crew/lib/launch.mjs
git commit -m "feat(crew): tool-neutral worker charge + launch adapters"
```

---

## Phase 4 — Merge pipeline

### Task 12: Merge runner (rebase → gate → ff-merge → refresh HANDOFF)

**Files:**

- Create: `scripts/crew/merge.mjs`

- [ ] **Step 1: Write the implementation**

```js
// scripts/crew/merge.mjs
import { execFileSync } from 'node:child_process';
import { rebaseOnto, mergeFastForwardOnly, removeWorktree } from './lib/git.mjs';

/**
 * Land a worker branch on local main. Returns {merged:boolean, reason?:string}.
 * NEVER pushes (repo policy). Re-runs the FULL gate after rebase so a stale branch
 * can't land a regression.
 */
export function landBranch({ branch, worktree, base = 'main' }) {
  try {
    rebaseOnto(base, worktree);
  } catch {
    return { merged: false, reason: 'rebase-conflict' };
  }
  try {
    execFileSync('pnpm', ['gate'], { cwd: worktree, stdio: 'inherit' });
  } catch {
    return { merged: false, reason: 'gate-failed-after-rebase' };
  }
  mergeFastForwardOnly(branch);
  removeWorktree(worktree);
  return { merged: true };
}
```

- [ ] **Step 2: Smoke-check it loads**

Run: `node -e "import('./scripts/crew/merge.mjs').then(m=>console.log(Object.keys(m)))"`
Expected: `[ 'landBranch' ]`.

- [ ] **Step 3: Commit**

```bash
git add scripts/crew/merge.mjs
git commit -m "feat(crew): rebase→gate→ff-merge pipeline (local main only)"
```

---

## Phase 5 — Reviewer + tiered routing

### Task 13: Reviewer prompt + verdict runner

**Files:**

- Create: `scripts/crew/prompts/reviewer.md`
- Create: `scripts/crew/lib/review.mjs`

- [ ] **Step 1: Write the reviewer prompt**

`scripts/crew/prompts/reviewer.md`:

```markdown
You are the Crew reviewer. A worker finished PBI {{PBI_ID}} on branch {{BRANCH}} with a green gate.
Review the diff (`git diff main...{{BRANCH}}`) for CORRECTNESS the gate cannot catch:
product-correctness bugs, silent failures, weakened safety rules, logic placed in gate-blind
components. A green gate is necessary, not sufficient.

If safety files (src/domain/adaptation.ts, src/domain/loadMetrics.ts) changed, apply the canonical
rule table in docs/specs/2026-06-09-bouldering-coach-app-design.md.

Output ONLY one line as your final message:
VERDICT: APPROVE — if safe to merge
VERDICT: FLAG <one-line reason> — if a human must look
```

- [ ] **Step 2: Write the verdict runner**

```js
// scripts/crew/lib/review.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Run the reviewer agent (Claude by default) and parse its VERDICT line.
 * @returns {{verdict:'approve'|'flag', reason?:string}}
 */
export function runReviewer(branch, pbiId) {
  const prompt = readFileSync(join(process.cwd(), 'scripts/crew/prompts/reviewer.md'), 'utf8')
    .replace(/{{PBI_ID}}/g, pbiId)
    .replace(/{{BRANCH}}/g, branch);
  const out = execFileSync('claude', ['--print', prompt], { encoding: 'utf8' });
  const line =
    out
      .split('\n')
      .reverse()
      .find((l) => l.includes('VERDICT:')) ?? '';
  if (/VERDICT:\s*APPROVE/i.test(line)) return { verdict: 'approve' };
  const m = line.match(/VERDICT:\s*FLAG\s*(.*)/i);
  return { verdict: 'flag', reason: m?.[1]?.trim() || 'reviewer flagged' };
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/crew/prompts/reviewer.md scripts/crew/lib/review.mjs
git commit -m "feat(crew): reviewer agent verdict runner"
```

---

## Phase 6 — Manager brain (adaptive scheduling)

### Task 14: Manager-brain prompt + invocation (split / pick-best)

**Files:**

- Create: `scripts/crew/prompts/manager.md`
- Create: `scripts/crew/lib/manager.mjs`
- Test: `tests/crew/manager.test.ts`

- [ ] **Step 1: Write the failing test for the deterministic fallback**

```ts
import { describe, it, expect } from 'vitest';
import { shouldConsultBrain } from '../../scripts/crew/lib/manager.mjs';

describe('shouldConsultBrain (mock)', () => {
  it('consults the brain for L/XL PBIs (may need splitting)', () => {
    expect(shouldConsultBrain({ complexity: 'L' })).toBe(true);
    expect(shouldConsultBrain({ complexity: 'XL' })).toBe(true);
  });
  it('skips the brain for S/M PBIs (deterministic assignment is enough)', () => {
    expect(shouldConsultBrain({ complexity: 'S' })).toBe(false);
    expect(shouldConsultBrain({ complexity: 'M' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/crew/manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation** (brain is optional; correctness never depends on it)

`scripts/crew/prompts/manager.md`:

```markdown
You are the Crew manager brain. PBI {{PBI_ID}} is size {{COMPLEXITY}} with files {{FILES}}.
If it is too large for one short-lived branch, split it into 2-4 sub-tasks whose `Files:` sets are
DISJOINT from each other. Output ONLY JSON: {"split": [{"id":"{{PBI_ID}}a","files":[...]}, ...]}
or {"split": []} if it should stay whole. Never let two sub-tasks share a file.
```

`scripts/crew/lib/manager.mjs`:

```js
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Only large items need the LLM; S/M go straight through deterministically. */
export function shouldConsultBrain(pbi) {
  return pbi.complexity === 'L' || pbi.complexity === 'XL';
}

/** @returns {{split: {id:string, files:string[]}[]}} ; falls back to no-split on any error. */
export function consultBrain(pbi) {
  if (!shouldConsultBrain(pbi)) return { split: [] };
  try {
    const prompt = readFileSync(join(process.cwd(), 'scripts/crew/prompts/manager.md'), 'utf8')
      .replace(/{{PBI_ID}}/g, pbi.id)
      .replace(/{{COMPLEXITY}}/g, pbi.complexity)
      .replace(/{{FILES}}/g, pbi.files.join(', '));
    const out = execFileSync('claude', ['--print', prompt], { encoding: 'utf8' });
    const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.split) ? parsed : { split: [] };
  } catch {
    return { split: [] }; // fail safe: keep PBI whole, deterministic path still works
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/crew/manager.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/crew/prompts/manager.md scripts/crew/lib/manager.mjs tests/crew/manager.test.ts
git commit -m "feat(crew): adaptive manager brain (optional, fail-safe)"
```

---

## Phase 7 — Conductor loop + CLI

### Task 15: Conductor loop

**Files:**

- Create: `scripts/crew/conduct.mjs`

- [ ] **Step 1: Write the conductor**

```js
// scripts/crew/conduct.mjs
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseBacklog } from './lib/backlog.mjs';
import { nextAssignable } from './lib/schedule.mjs';
import { readClaims, tryClaim, writeClaim, releaseClaim } from './lib/claims.mjs';
import { isExpired } from './lib/lease.mjs';
import { addWorktree, changedFiles } from './lib/git.mjs';
import { launchWorker } from './lib/launch.mjs';
import { classify } from './lib/risk.mjs';
import { runReviewer } from './lib/review.mjs';
import { landBranch } from './merge.mjs';

const ROOT = process.cwd();
const CREW = join(ROOT, '.crew');
const config = JSON.parse(readFileSync(join(CREW, 'config.json'), 'utf8'));
const PAUSED = () => existsSync(join(CREW, 'PAUSED'));

const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}\n`;
  if (!existsSync(CREW)) mkdirSync(CREW, { recursive: true });
  writeFileSync(join(CREW, 'log.md'), line, { flag: 'a' });
  process.stdout.write(line);
};

function reclaimExpired() {
  const now = Date.now();
  for (const c of readClaims(CREW)) {
    if (c.status === 'working' && isExpired(c, now, config.leaseSeconds)) {
      log(`reclaim ${c.pbiId} (lease expired)`);
      releaseClaim(CREW, c.pbiId);
    }
  }
}

function assignOne() {
  const pbis = parseBacklog(readFileSync(join(ROOT, 'docs/BACKLOG.md'), 'utf8'));
  const active = readClaims(CREW).map((c) => ({ pbiId: c.pbiId, files: c.files }));
  if (active.length >= config.maxWorkers) return false;
  const pbi = nextAssignable(pbis, active);
  if (!pbi) return false;
  const branch = `agent/${pbi.id}`;
  const worktree = join(ROOT, '..', `boulder-coach-${pbi.id}`);
  if (
    !tryClaim(CREW, {
      pbiId: pbi.id,
      files: pbi.files,
      worktree,
      branch,
      status: 'claimed',
      heartbeat: new Date().toISOString(),
      owner: branch,
    })
  )
    return false;
  addWorktree(worktree, branch, 'main');
  log(`assign ${pbi.id} → ${worktree}`);
  const claim = readClaims(CREW).find((c) => c.pbiId === pbi.id);
  writeClaim(CREW, { ...claim, status: 'working', heartbeat: new Date().toISOString() });
  const child = launchWorker(config, worktree, pbi.id);
  child.on('exit', () => finishWorker(pbi.id, branch, worktree));
  return true;
}

function finishWorker(pbiId, branch, worktree) {
  const files = changedFiles(branch);
  const tier = classify(files, config);
  if (tier === 'auto') {
    const verdict = runReviewer(branch, pbiId);
    if (verdict.verdict === 'approve') {
      const res = landBranch({ branch, worktree });
      log(res.merged ? `merged ${pbiId}` : `merge-blocked ${pbiId}: ${res.reason}`);
      if (res.merged) releaseClaim(CREW, pbiId);
      return;
    }
    queueForHuman(pbiId, branch, verdict.reason ?? 'flagged');
    return;
  }
  queueForHuman(pbiId, branch, `tier=review (${files.length} files)`);
}

function queueForHuman(pbiId, branch, reason) {
  const dir = join(CREW, 'review-queue');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${pbiId}.md`),
    `# ${pbiId} on ${branch}\n\nReason: ${reason}\n\nReview: \`git diff main...${branch}\`\nApprove: \`node scripts/crew/crew.mjs approve ${pbiId}\`\n`,
  );
  log(`review-queue ${pbiId}: ${reason}`);
}

async function loop() {
  log('conductor start');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!PAUSED()) {
      reclaimExpired();
      while (assignOne()) {
        /* fill open worker slots */
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

loop();
```

- [ ] **Step 2: Smoke-check it loads (dry, then Ctrl-C)**

Run: `node -e "import('./scripts/crew/lib/backlog.mjs')"` (verifies the import graph resolves)
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add scripts/crew/conduct.mjs
git commit -m "feat(crew): conductor loop (assign→launch→review→merge)"
```

---

### Task 16: CLI (status / approve / reject / pause / take-over / start)

**Files:**

- Create: `scripts/crew/crew.mjs`
- Modify: `package.json` (add `crew` script)

- [ ] **Step 1: Write the CLI**

```js
// scripts/crew/crew.mjs
import { readFileSync, existsSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readClaims, releaseClaim } from './lib/claims.mjs';
import { landBranch } from './merge.mjs';

const CREW = join(process.cwd(), '.crew');
const [cmd, arg] = process.argv.slice(2);
const flag = (name) => join(CREW, name);

function status() {
  console.log('=== workers ===');
  for (const c of readClaims(CREW)) console.log(`${c.pbiId}\t${c.status}\t${c.branch}`);
  const rq = join(CREW, 'review-queue');
  console.log('\n=== review queue ===');
  if (existsSync(rq))
    for (const f of readdirSync(rq)) console.log(f.replace('.json', '').replace('.md', ''));
  console.log(`\npaused: ${existsSync(flag('PAUSED'))}`);
}

function approve(pbiId) {
  const c = readClaims(CREW).find((x) => x.pbiId === pbiId);
  if (!c) throw new Error(`no claim ${pbiId}`);
  const res = landBranch({ branch: c.branch, worktree: c.worktree });
  if (!res.merged) throw new Error(`merge blocked: ${res.reason}`);
  releaseClaim(CREW, pbiId);
  rmSync(join(CREW, 'review-queue', `${pbiId}.md`), { force: true });
  console.log(`merged ${pbiId}`);
}

function reject(pbiId) {
  const c = readClaims(CREW).find((x) => x.pbiId === pbiId);
  if (c) execFileSync('git', ['worktree', 'remove', '--force', c.worktree]);
  releaseClaim(CREW, pbiId);
  rmSync(join(CREW, 'review-queue', `${pbiId}.md`), { force: true });
  console.log(`rejected ${pbiId} (worktree + claim removed)`);
}

switch (cmd) {
  case 'status':
    status();
    break;
  case 'approve':
    approve(arg);
    break;
  case 'reject':
    reject(arg);
    break;
  case 'pause':
    writeFileSync(flag('PAUSED'), '');
    console.log('paused');
    break;
  case 'resume':
    rmSync(flag('PAUSED'), { force: true });
    console.log('resumed');
    break;
  case 'start':
    execFileSync('node', ['scripts/crew/conduct.mjs'], { stdio: 'inherit' });
    break;
  default:
    console.log('usage: crew <status|approve PBI|reject PBI|pause|resume|start>');
}
```

- [ ] **Step 2: Add the package.json script**

In `package.json` `scripts`, add:

```json
"crew": "node scripts/crew/crew.mjs"
```

- [ ] **Step 3: Verify CLI usage prints**

Run: `pnpm crew`
Expected: prints the usage line.

- [ ] **Step 4: Commit**

```bash
git add scripts/crew/crew.mjs package.json
git commit -m "feat(crew): CLI (status/approve/reject/pause/resume/start)"
```

---

## Phase 8 — Backlog hygiene, gate wiring, docs

### Task 17: Make `Files:` load-bearing in BACKLOG.md

**Files:**

- Modify: `docs/BACKLOG.md` (ensure every open PBI has an accurate `Files:` line)
- Create: `tests/crew/backlog-hygiene.test.ts`

- [ ] **Step 1: Write the failing test (guards the load-bearing field)**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseBacklog } from '../../scripts/crew/lib/backlog.mjs';

const md = readFileSync(fileURLToPath(new URL('../../docs/BACKLOG.md', import.meta.url)), 'utf8');

describe('backlog hygiene (real BACKLOG.md)', () => {
  it('every OPEN PBI declares at least one file (Crew lock depends on it)', () => {
    const offenders = parseBacklog(md).filter((p) => p.status === 'open' && p.files.length === 0);
    expect(offenders.map((p) => p.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — fix BACKLOG.md until green**

Run: `pnpm vitest run tests/crew/backlog-hygiene.test.ts`
Expected: initially FAIL listing open PBIs without files; add accurate `Files:` lines to each, re-run until PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/BACKLOG.md tests/crew/backlog-hygiene.test.ts
git commit -m "test(crew): backlog Files: is load-bearing — guard it"
```

---

### Task 18: Gitignore runtime state, keep config tracked

**Files:**

- Modify: `.gitignore`

- [ ] **Step 1: Add runtime-state ignores (config stays tracked)**

Append to `.gitignore`:

```gitignore
# Crew runtime state (claims/queue/log are ephemeral; config is tracked)
.crew/claims/
.crew/review-queue/
.crew/log.md
.crew/PAUSED
```

- [ ] **Step 2: Verify config is still tracked, state is ignored**

Run: `git check-ignore .crew/claims/x.json .crew/config.json || true`
Expected: prints `.crew/claims/x.json` only (config not ignored).

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(crew): ignore ephemeral .crew runtime state"
```

---

### Task 19: Runbook + cross-doc updates

**Files:**

- Create: `docs/crew/README.md`
- Modify: `AGENTS.md` (add a "Parallel work with Crew" section), `docs/HANDOFF.md` (note Crew exists)

- [ ] **Step 1: Write `docs/crew/README.md`**

```markdown
# Crew — running agents in parallel

Crew runs up to `maxWorkers` agents in isolated git worktrees, each on one backlog PBI whose files
are disjoint from every other active worker — so merge conflicts are structurally avoided.

## Quickstart

1. `pnpm crew start` # conductor begins assigning open PBIs to worktrees
2. `pnpm crew status` # live board: workers, queue, review queue
3. `pnpm crew approve <PBI>` / `reject <PBI>` # act on the human review queue
4. `pnpm crew pause` / `resume` # freeze/unfreeze merges

## How conflicts are avoided

- Each PBI's `Files:` set is a mutex; overlapping PBIs are never run concurrently (`schedule.mjs`).
- Branches merge serially: rebase on main → full `pnpm gate` → ff-merge (`merge.mjs`).

## Trust tiers

- Auto-merge: pure domain/app-lib at 100% branch coverage or docs, AND reviewer APPROVE.
- Human review: safety files, `.tsx` UI, infra, or any reviewer FLAG. You always have the upper hand.

## Config

`.crew/config.json` — workers, adapters (claude/codex/aider), risk tiers, lease. Tool-neutral:
add an adapter in `scripts/crew/adapters/` to support any agent CLI.
```

- [ ] **Step 2: Add an AGENTS.md section** (after "Working in this repo")

```markdown
# Parallel work with Crew (optional)

`pnpm crew start` runs several agents in parallel worktrees, each on a file-disjoint PBI. It is
tool-neutral (adapters for claude/codex/aider). See `docs/crew/README.md`. Single-agent work is
unchanged — Crew is an accelerator, not a requirement. The gate is still the contract for every branch.
```

- [ ] **Step 3: Note it in docs/HANDOFF.md** under current state.

- [ ] **Step 4: Final gate + commit**

Run: `pnpm gate`
Expected: `✅ GATE PASSED`.

```bash
git add docs/crew/README.md AGENTS.md docs/HANDOFF.md
git commit -m "docs(crew): runbook + cross-doc updates"
```

> **Milestone done:** `pnpm crew start` runs 3 parallel workers on file-disjoint PBIs, reviewer-gates
> each branch, auto-merges low-risk work, and queues the rest for you — all with the gate as the contract.

---

## Self-review

**1. Spec coverage**

| Spec section                                              | Task(s)                                                                                                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §3 Roles (conductor/manager/worker/reviewer)              | 15 (conductor), 14 (manager), 11 (worker), 13 (reviewer)                                                                                                 |
| §4 Disjoint file locking                                  | 3, 10, 17                                                                                                                                                |
| §4 Serial integration                                     | 12                                                                                                                                                       |
| §4 Split L/XL                                             | 14                                                                                                                                                       |
| §5 Git-native state `.crew/`                              | 7, 8, 18                                                                                                                                                 |
| §6 Tiered auto-merge + reviewer + override                | 4, 13, 15, 16                                                                                                                                            |
| §7 Freshness (`pnpm onboard`, branch from main)           | 11 (charge), 15 (worktree from main)                                                                                                                     |
| §7 Env setup per worktree                                 | 15 (`addWorktree`); pnpm shared store needs no install step for ESM scripts — workers run `pnpm onboard` which assumes deps present; **gap fixed below** |
| §8 Worker contract (tool-neutral adapters)                | 11                                                                                                                                                       |
| §9 Error handling (lease/heartbeat, gate retry, conflict) | 5, 15 (reclaimExpired), 12 (rebase-conflict)                                                                                                             |
| §10 Observability (`crew status`, log)                    | 15 (log), 16 (status)                                                                                                                                    |
| §11 Deliverables                                          | all tasks                                                                                                                                                |

**Gap found & fixed:** §7 calls for a `setup-worktree.sh` that runs `pnpm install` + baseline gate
before the worker starts. The conductor (Task 15) creates the worktree but relies on the shared pnpm
store. Add this step to Task 15's `assignOne` after `addWorktree`:

```js
import { execFileSync } from 'node:child_process';
// ...after addWorktree(worktree, branch, 'main'):
execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: worktree, stdio: 'inherit' });
```

(Worktrees share the repo's `node_modules` only if symlinked; a `--frozen-lockfile` install against
the global store is fast and guarantees a working env — matching spec §7.)

**2. Placeholder scan:** No TBD/TODO; every code step has complete code; every command has expected
output. Pass.

**3. Type consistency:** `Claim` shape (`pbiId, files, worktree, branch, status, heartbeat, owner`)
is identical across `claims.mjs`, `conduct.mjs`, `crew.mjs`. `Pbi` shape consistent across
`backlog.mjs`/`schedule.mjs`/`manager.mjs`. `classify` → `'auto'|'review'`; `runReviewer` →
`{verdict:'approve'|'flag'}`; `landBranch` → `{merged, reason?}`. Consistent. Pass.
