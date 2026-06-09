# Bouldering Coach — Core Engine (Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trustworthy, fully-tested domain engine (load metrics, periodization, warm-up, adaptive rules) behind a swappable local storage layer, surfaced through a minimal working "Today" screen.

**Architecture:** Pure-TypeScript domain layer (no I/O) holds all coaching logic and is unit-tested in isolation. A repository interface (`IClimbRepo`) decouples domain from storage; a Dexie/IndexedDB implementation backs it now, a cloud impl can replace it later. Next.js App Router renders a mobile-first PWA; the "Today" screen wires domain + repo together end-to-end.

**Tech Stack:** Next.js (App Router) + TypeScript, Tailwind, Vitest (domain tests), Dexie (IndexedDB), pnpm.

---

## File Structure

```
boulder-coach/
  src/
    domain/
      types.ts            # all shared domain types
      loadMetrics.ts      # sRPE, acute/chronic, ACWR
      warmup.ts           # RAMP warm-up generator
      periodization.ts    # generates the 6-week program
      adaptation.ts       # the rules engine (adjusts today's session)
    data/
      IClimbRepo.ts       # repository interface (swap point)
      dexieRepo.ts        # IndexedDB implementation
    app/
      page.tsx            # "Today" screen
      layout.tsx          # root layout (scaffolded)
      lib/
        bootstrap.ts      # ensures a program + profile exist, returns today's adapted session
  tests/
    domain/
      loadMetrics.test.ts
      warmup.test.ts
      periodization.test.ts
      adaptation.test.ts
  vitest.config.ts
```

**Decomposition rationale:** Each domain module is one pure responsibility and is independently testable. `adaptation.ts` consumes the others' _types_ but not their I/O. The repo interface is the only seam the UI and future cloud impl share.

---

## Task 1: Scaffold the project

**Files:**

- Create: whole `boulder-coach/` project

- [ ] **Step 1: Scaffold Next.js app (non-interactive)**

Run from `/Users/dafandikri/Documents/Personal/Climbing-App`:

```bash
pnpm create next-app@latest boulder-coach --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm --yes
```

Expected: project created in `boulder-coach/`, exits 0.

- [ ] **Step 2: Add domain/test/storage deps**

```bash
cd boulder-coach
pnpm add dexie
pnpm add -D vitest @vitest/coverage-v8
```

Expected: dependencies install, exits 0.

- [ ] **Step 3: Add Vitest config**

Create `boulder-coach/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Add test script**

Modify `boulder-coach/package.json` — add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verify scaffold builds**

Run: `pnpm test`
Expected: Vitest runs, reports "No test files found" (exit 0) — confirms config loads.

- [ ] **Step 6: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold boulder-coach (next.js + vitest + dexie)"
```

---

## Task 2: Domain types

**Files:**

- Create: `boulder-coach/src/domain/types.ts`

- [ ] **Step 1: Write the types**

Create `src/domain/types.ts`:

```ts
/** V-scale bouldering grade, e.g. 4 === V4. */
export type VGrade = number;

export type SessionType =
  | 'limit-boulder'
  | 'power-endurance'
  | 'volume-technique'
  | 'antagonist-prehab'
  | 'rest';

export type GripType = 'crimp' | 'open-hand' | 'mixed';

export type BodyPart = 'pip' | 'wrist-tfcc' | 'shoulder' | 'elbow';

export type BlockCategory = 'warmup' | 'main' | 'prehab' | 'technique' | 'cooldown';

export interface Block {
  id: string;
  name: string;
  category: BlockCategory;
  grip: GripType;
  /** number of work sets / problems */
  sets: number;
  targetGrade?: VGrade;
  targetRPE: number; // 1..10
  notes?: string;
}

export interface PlannedSession {
  id: string;
  programId: string;
  weekIndex: number;
  dayIndex: number;
  type: SessionType;
  blocks: Block[];
}

export type PhaseKind = 'hard' | 'peak' | 'deload';

export interface ProgramWeek {
  weekIndex: number;
  phase: PhaseKind;
  sessions: PlannedSession[];
}

export interface Program {
  id: string;
  startDate: string; // ISO date
  lengthWeeks: number;
  currentWeekIndex: number;
  weeks: ProgramWeek[];
}

export interface UserProfile {
  currentGrade: VGrade;
  goalGrade: VGrade;
  sessionsPerWeek: number; // 2..4
  availableWeekdays: number[]; // 0=Sun .. 6=Sat
}

/** 1..3 severity for soreness; 1..3 for sharp pain. Absent = none. */
export interface CheckIn {
  date: string; // ISO
  sleepQuality: number; // 1..5 (5 = great)
  overallFatigue: number; // 1..5 (5 = exhausted)
  soreness: Partial<Record<BodyPart, number>>;
  pain: Partial<Record<BodyPart, number>>;
  motivation: number; // 1..5
}

export interface LoggedBlock {
  blockId: string;
  setsCompleted: number;
  gradesAttempted: VGrade[];
  gradesSent: VGrade[];
  rpe: number; // 1..10
}

export interface SessionLog {
  id: string;
  date: string; // ISO
  plannedSessionId?: string;
  warmupCompleted: boolean;
  blocks: LoggedBlock[];
  sessionRPE: number; // 1..10
  durationMin: number;
  notes?: string;
}

export interface LoadMetrics {
  acute: number; // 7-day load sum
  chronic: number; // 28-day load as weekly-equivalent
  acwr: number; // acute / chronic, 0 when chronic is 0
}

export interface AdaptationChange {
  ruleId: string;
  reason: string;
}

export interface AdaptationResult {
  adjustedSession: PlannedSession;
  changes: AdaptationChange[];
  warmupMandatory: boolean;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts && git commit -m "feat(domain): add core types"
```

---

## Task 3: Load metrics (ACWR)

**Files:**

- Create: `boulder-coach/src/domain/loadMetrics.ts`
- Test: `boulder-coach/tests/domain/loadMetrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/loadMetrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeLoadMetrics } from '../../src/domain/loadMetrics';
import type { SessionLog } from '../../src/domain/types';

function log(date: string, sessionRPE: number, durationMin: number): SessionLog {
  return {
    id: date,
    date,
    warmupCompleted: true,
    blocks: [],
    sessionRPE,
    durationMin,
  };
}

describe('computeLoadMetrics', () => {
  it('returns zero metrics with no logs', () => {
    const m = computeLoadMetrics([], new Date('2026-06-09'));
    expect(m).toEqual({ acute: 0, chronic: 0, acwr: 0 });
  });

  it('sums acute load over the last 7 days inclusive', () => {
    const logs = [
      log('2026-06-09', 8, 60), // 480, day 0
      log('2026-06-07', 6, 60), // 360, day -2
      log('2026-06-01', 9, 60), // 540, day -8 (excluded from acute)
    ];
    const m = computeLoadMetrics(logs, new Date('2026-06-09'));
    expect(m.acute).toBe(840);
  });

  it('computes chronic as 28-day load divided by 4 (weekly-equivalent)', () => {
    const logs = [
      log('2026-06-09', 10, 40), // 400
      log('2026-05-20', 10, 40), // 400, within 28 days
      log('2026-05-01', 10, 40), // 400, older than 28 days (excluded)
    ];
    const m = computeLoadMetrics(logs, new Date('2026-06-09'));
    expect(m.chronic).toBe(200); // (400 + 400) / 4
  });

  it('computes acwr = acute / chronic rounded to 2 decimals', () => {
    const logs = [
      log('2026-06-09', 10, 60), // 600 acute + chronic
      log('2026-05-25', 10, 60), // 600 chronic only (15 days ago)
    ];
    const m = computeLoadMetrics(logs, new Date('2026-06-09'));
    // acute = 600, chronic = (600 + 600)/4 = 300, acwr = 2.0
    expect(m.acute).toBe(600);
    expect(m.chronic).toBe(300);
    expect(m.acwr).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test loadMetrics`
Expected: FAIL — cannot find module `loadMetrics`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/loadMetrics.ts`:

```ts
import type { SessionLog, LoadMetrics } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function loadOf(l: SessionLog): number {
  return l.sessionRPE * l.durationMin;
}

function daysBetween(asOf: Date, dateIso: string): number {
  const d = new Date(dateIso).getTime();
  return Math.floor((asOf.getTime() - d) / DAY_MS);
}

export function computeLoadMetrics(logs: SessionLog[], asOf: Date): LoadMetrics {
  let acute = 0;
  let chronicTotal = 0;
  for (const l of logs) {
    const age = daysBetween(asOf, l.date);
    if (age < 0) continue;
    if (age < 7) acute += loadOf(l);
    if (age < 28) chronicTotal += loadOf(l);
  }
  const chronic = chronicTotal / 4;
  const acwr = chronic === 0 ? 0 : Math.round((acute / chronic) * 100) / 100;
  return { acute, chronic, acwr };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test loadMetrics`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/loadMetrics.ts tests/domain/loadMetrics.test.ts
git commit -m "feat(domain): ACWR load metrics"
```

---

## Task 4: Warm-up generator (RAMP)

**Files:**

- Create: `boulder-coach/src/domain/warmup.ts`
- Test: `boulder-coach/tests/domain/warmup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/warmup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateWarmup } from '../../src/domain/warmup';

describe('generateWarmup', () => {
  it('produces RAMP phases ending in potentiation', () => {
    const blocks = generateWarmup({ injuryActive: false });
    const names = blocks.map((b) => b.name.toLowerCase());
    expect(names.some((n) => n.includes('cardio'))).toBe(true);
    expect(names.some((n) => n.includes('mobil'))).toBe(true);
    expect(names.some((n) => n.includes('easy'))).toBe(true);
    // all warmup blocks are categorised as warmup
    expect(blocks.every((b) => b.category === 'warmup')).toBe(true);
  });

  it('uses open-hand grip first on the climbing potentiation block', () => {
    const blocks = generateWarmup({ injuryActive: false });
    const climb = blocks.find((b) => b.name.toLowerCase().includes('easy'));
    expect(climb?.grip).toBe('open-hand');
  });

  it('adds extra mobilization when an injury flag is active', () => {
    const normal = generateWarmup({ injuryActive: false });
    const injured = generateWarmup({ injuryActive: true });
    expect(injured.length).toBeGreaterThan(normal.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test warmup`
Expected: FAIL — cannot find module `warmup`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/warmup.ts`:

```ts
import type { Block } from './types';

export interface WarmupOptions {
  injuryActive: boolean;
}

export function generateWarmup({ injuryActive }: WarmupOptions): Block[] {
  const blocks: Block[] = [
    {
      id: 'wu-raise',
      name: 'Raise: light cardio',
      category: 'warmup',
      grip: 'open-hand',
      sets: 1,
      targetRPE: 3,
      notes: '5–10 min jog / row / skip to raise heart rate.',
    },
    {
      id: 'wu-mobilize',
      name: 'Activate & Mobilize: dynamic shoulder/wrist/finger',
      category: 'warmup',
      grip: 'open-hand',
      sets: 1,
      targetRPE: 3,
      notes: 'Arm circles, wrist rotations, finger tendon glides.',
    },
    {
      id: 'wu-potentiate',
      name: 'Potentiate: easy climbing ramp',
      category: 'warmup',
      grip: 'open-hand',
      sets: 10,
      targetRPE: 4,
      notes: '8–12 easy problems, low→high intensity, open-hand first.',
    },
  ];

  if (injuryActive) {
    blocks.splice(2, 0, {
      id: 'wu-extra-mobilize',
      name: 'Extra mobilization (injury flag active)',
      category: 'warmup',
      grip: 'open-hand',
      sets: 1,
      targetRPE: 2,
      notes: 'Extended joint-specific mobility before any loading.',
    });
  }

  return blocks;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test warmup`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/warmup.ts tests/domain/warmup.test.ts
git commit -m "feat(domain): RAMP warm-up generator"
```

---

## Task 5: Periodization (program generator)

**Files:**

- Create: `boulder-coach/src/domain/periodization.ts`
- Test: `boulder-coach/tests/domain/periodization.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/periodization.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateProgram, PHASE_PATTERN } from '../../src/domain/periodization';
import type { UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5,
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

describe('generateProgram', () => {
  it('builds a 6-week waved mesocycle', () => {
    const p = generateProgram(profile, '2026-06-09');
    expect(p.lengthWeeks).toBe(6);
    expect(p.weeks).toHaveLength(6);
    expect(p.weeks.map((w) => w.phase)).toEqual(PHASE_PATTERN);
  });

  it('schedules sessionsPerWeek sessions in each week', () => {
    const p = generateProgram(profile, '2026-06-09');
    for (const w of p.weeks) {
      expect(w.sessions).toHaveLength(3);
    }
  });

  it('includes a non-empty warm-up plus main work in each session', () => {
    const p = generateProgram(profile, '2026-06-09');
    const s = p.weeks[0].sessions[0];
    expect(s.blocks.some((b) => b.category === 'warmup')).toBe(true);
    expect(s.blocks.some((b) => b.category === 'main')).toBe(true);
  });

  it('targets at or above current grade on limit days in hard weeks', () => {
    const p = generateProgram(profile, '2026-06-09');
    const limit = p.weeks[0].sessions.find((s) => s.type === 'limit-boulder');
    const mainBlock = limit?.blocks.find((b) => b.category === 'main');
    expect(mainBlock?.targetGrade).toBeGreaterThanOrEqual(profile.currentGrade);
  });

  it('reduces main volume in deload weeks vs hard weeks', () => {
    const p = generateProgram(profile, '2026-06-09');
    const hardMain = p.weeks[0].sessions[0].blocks
      .filter((b) => b.category === 'main')
      .reduce((s, b) => s + b.sets, 0);
    const deloadMain = p.weeks[2].sessions[0].blocks
      .filter((b) => b.category === 'main')
      .reduce((s, b) => s + b.sets, 0);
    expect(deloadMain).toBeLessThan(hardMain);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test periodization`
Expected: FAIL — cannot find module `periodization`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/periodization.ts`:

```ts
import type {
  Block,
  PhaseKind,
  PlannedSession,
  Program,
  ProgramWeek,
  SessionType,
  UserProfile,
} from './types';
import { generateWarmup } from './warmup';

export const PHASE_PATTERN: PhaseKind[] = ['hard', 'hard', 'deload', 'hard', 'peak', 'deload'];

/** Volume multiplier applied to main work by phase. */
const PHASE_VOLUME: Record<PhaseKind, number> = {
  hard: 1,
  peak: 0.85,
  deload: 0.5,
};

/** Session rotation by how many sessions the climber does per week. */
function sessionPlanFor(sessionsPerWeek: number): SessionType[] {
  switch (sessionsPerWeek) {
    case 2:
      return ['limit-boulder', 'power-endurance'];
    case 4:
      return ['limit-boulder', 'power-endurance', 'volume-technique', 'antagonist-prehab'];
    case 3:
    default:
      return ['limit-boulder', 'power-endurance', 'volume-technique'];
  }
}

function mainBlocksFor(type: SessionType, phase: PhaseKind, currentGrade: number): Block[] {
  const vol = PHASE_VOLUME[phase];
  const round = (n: number) => Math.max(1, Math.round(n));

  switch (type) {
    case 'limit-boulder':
      return [
        {
          id: 'main-limit',
          name: 'Limit bouldering',
          category: 'main',
          grip: 'mixed',
          sets: round(6 * vol),
          targetGrade: currentGrade + (phase === 'peak' ? 1 : 0),
          targetRPE: phase === 'deload' ? 6 : 9,
          notes: 'Few hard moves, long rest. Stop on form breakdown.',
        },
      ];
    case 'power-endurance':
      return [
        {
          id: 'main-4x4',
          name: '4×4 power-endurance',
          category: 'main',
          grip: 'mixed',
          sets: round(4 * vol),
          targetGrade: Math.max(1, currentGrade - 1),
          targetRPE: phase === 'deload' ? 6 : 8,
          notes: '4 problems × 4 rounds at onsight grade.',
        },
      ];
    case 'volume-technique':
      return [
        {
          id: 'main-volume',
          name: 'Volume + drill focus',
          category: 'main',
          grip: 'open-hand',
          sets: round(12 * vol),
          targetGrade: Math.max(1, currentGrade - 2),
          targetRPE: 6,
          notes: 'Moderate grades, one deliberate drill (e.g. silent feet).',
        },
      ];
    case 'antagonist-prehab':
      return [
        {
          id: 'main-antagonist',
          name: 'Antagonist + prehab circuit',
          category: 'main',
          grip: 'open-hand',
          sets: round(3 * vol),
          targetRPE: 6,
          notes: 'Shoulder, wrist/TFCC (ECU), finger-extensor band work.',
        },
      ];
    default:
      return [];
  }
}

function cooldownPrehab(): Block {
  return {
    id: 'cooldown-prehab',
    name: 'Cooldown prehab',
    category: 'cooldown',
    grip: 'open-hand',
    sets: 2,
    targetRPE: 4,
    notes: 'Rotator-cuff + wrist + finger-extensor maintenance.',
  };
}

function buildSession(
  programId: string,
  weekIndex: number,
  dayIndex: number,
  type: SessionType,
  phase: PhaseKind,
  currentGrade: number,
): PlannedSession {
  const blocks: Block[] = [
    ...generateWarmup({ injuryActive: false }),
    ...mainBlocksFor(type, phase, currentGrade),
    cooldownPrehab(),
  ];
  return {
    id: `${programId}-w${weekIndex}-d${dayIndex}`,
    programId,
    weekIndex,
    dayIndex,
    type,
    blocks,
  };
}

export function generateProgram(profile: UserProfile, startDate: string): Program {
  const programId = `prog-${startDate}`;
  const rotation = sessionPlanFor(profile.sessionsPerWeek);

  const weeks: ProgramWeek[] = PHASE_PATTERN.map((phase, weekIndex) => {
    const sessions = rotation.map((type, dayIndex) =>
      buildSession(programId, weekIndex, dayIndex, type, phase, profile.currentGrade),
    );
    return { weekIndex, phase, sessions };
  });

  return {
    id: programId,
    startDate,
    lengthWeeks: 6,
    currentWeekIndex: 0,
    weeks,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test periodization`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/periodization.ts tests/domain/periodization.test.ts
git commit -m "feat(domain): 6-week periodized program generator"
```

---

## Task 6: Adaptation rules engine

**Files:**

- Create: `boulder-coach/src/domain/adaptation.ts`
- Test: `boulder-coach/tests/domain/adaptation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/adaptation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { adapt } from '../../src/domain/adaptation';
import type { CheckIn, LoadMetrics, PlannedSession } from '../../src/domain/types';

function neutralCheckIn(): CheckIn {
  return {
    date: '2026-06-09',
    sleepQuality: 4,
    overallFatigue: 2,
    soreness: {},
    pain: {},
    motivation: 4,
  };
}

function session(): PlannedSession {
  return {
    id: 's1',
    programId: 'p',
    weekIndex: 0,
    dayIndex: 0,
    type: 'limit-boulder',
    blocks: [
      {
        id: 'wu',
        name: 'Potentiate: easy climbing',
        category: 'warmup',
        grip: 'open-hand',
        sets: 10,
        targetRPE: 4,
      },
      {
        id: 'm',
        name: 'Limit bouldering',
        category: 'main',
        grip: 'crimp',
        sets: 6,
        targetGrade: 5,
        targetRPE: 9,
      },
      {
        id: 'cd',
        name: 'Cooldown prehab',
        category: 'cooldown',
        grip: 'open-hand',
        sets: 2,
        targetRPE: 4,
      },
    ],
  };
}

const okMetrics: LoadMetrics = { acute: 300, chronic: 300, acwr: 1.0 };

function totalMainSets(s: PlannedSession): number {
  return s.blocks.filter((b) => b.category === 'main').reduce((n, b) => n + b.sets, 0);
}

describe('adapt — safety first', () => {
  it('on sharp pain: cuts main volume ~50%, swaps in prehab, mandates warm-up', () => {
    const ci = neutralCheckIn();
    ci.pain = { pip: 2 };
    const r = adapt(session(), ci, [], okMetrics);
    expect(r.warmupMandatory).toBe(true);
    expect(totalMainSets(r.adjustedSession)).toBeLessThanOrEqual(3);
    expect(r.adjustedSession.blocks.some((b) => b.category === 'prehab')).toBe(true);
    expect(r.changes[0].ruleId).toBe('pain');
  });

  it('on TFCC pain: removes crimp/sloper main grip work', () => {
    const ci = neutralCheckIn();
    ci.pain = { 'wrist-tfcc': 2 };
    const r = adapt(session(), ci, [], okMetrics);
    const main = r.adjustedSession.blocks.filter((b) => b.category === 'main');
    expect(main.every((b) => b.grip !== 'crimp')).toBe(true);
  });

  it('on soreness (no pain): swaps crimp grip to open-hand', () => {
    const ci = neutralCheckIn();
    ci.soreness = { pip: 2 };
    const r = adapt(session(), ci, [], okMetrics);
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main?.grip).toBe('open-hand');
    expect(r.changes.some((c) => c.ruleId === 'soreness')).toBe(true);
  });

  it('pain takes priority over a "crushing it" progression', () => {
    const ci = neutralCheckIn();
    ci.pain = { shoulder: 3 };
    const r = adapt(session(), ci, [], okMetrics);
    // volume cut, not increased
    expect(totalMainSets(r.adjustedSession)).toBeLessThan(totalMainSets(session()));
  });
});

describe('adapt — load', () => {
  it('forces a deload when ACWR > 1.5', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 600, chronic: 300, acwr: 2.0 });
    expect(totalMainSets(r.adjustedSession)).toBeLessThan(totalMainSets(session()));
    expect(r.changes.some((c) => c.ruleId === 'acwr-high')).toBe(true);
  });

  it('caps intensity (no new max) when ACWR 1.3–1.5', () => {
    const r = adapt(session(), neutralCheckIn(), [], { acute: 420, chronic: 300, acwr: 1.4 });
    const main = r.adjustedSession.blocks.find((b) => b.category === 'main');
    expect(main!.targetRPE).toBeLessThanOrEqual(8);
    expect(r.changes.some((c) => c.ruleId === 'acwr-caution')).toBe(true);
  });
});

describe('adapt — fatigue & default', () => {
  it('trims volume on poor sleep / high fatigue', () => {
    const ci = neutralCheckIn();
    ci.sleepQuality = 1;
    ci.overallFatigue = 5;
    const r = adapt(session(), ci, [], okMetrics);
    expect(totalMainSets(r.adjustedSession)).toBeLessThan(totalMainSets(session()));
    expect(r.changes.some((c) => c.ruleId === 'fatigue')).toBe(true);
  });

  it('returns the session unchanged on a neutral day', () => {
    const r = adapt(session(), neutralCheckIn(), [], okMetrics);
    expect(totalMainSets(r.adjustedSession)).toBe(totalMainSets(session()));
    expect(r.changes).toHaveLength(0);
    expect(r.warmupMandatory).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test adaptation`
Expected: FAIL — cannot find module `adaptation`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/adaptation.ts`:

```ts
import type {
  AdaptationChange,
  AdaptationResult,
  Block,
  BodyPart,
  CheckIn,
  LoadMetrics,
  PlannedSession,
  SessionLog,
} from './types';

/** Deep-ish clone so rules never mutate the planned template. */
function cloneSession(s: PlannedSession): PlannedSession {
  return { ...s, blocks: s.blocks.map((b) => ({ ...b })) };
}

function mainBlocks(s: PlannedSession): Block[] {
  return s.blocks.filter((b) => b.category === 'main');
}

function scaleMainVolume(s: PlannedSession, factor: number): void {
  for (const b of s.blocks) {
    if (b.category === 'main') {
      b.sets = Math.max(1, Math.round(b.sets * factor));
    }
  }
}

function prehabBlock(): Block {
  return {
    id: 'inserted-prehab',
    name: 'Prehab + technique (substituted)',
    category: 'prehab',
    grip: 'open-hand',
    sets: 3,
    targetRPE: 5,
    notes: 'Joint-specific prehab and easy technique work.',
  };
}

const PART_LABEL: Record<BodyPart, string> = {
  pip: 'finger (PIP)',
  'wrist-tfcc': 'wrist (TFCC)',
  shoulder: 'shoulder',
  elbow: 'elbow',
};

function firstFlagged(map: Partial<Record<BodyPart, number>>): BodyPart | undefined {
  return (Object.keys(map) as BodyPart[]).find((k) => (map[k] ?? 0) > 0);
}

export function adapt(
  planned: PlannedSession,
  checkIn: CheckIn,
  _recentLogs: SessionLog[],
  metrics: LoadMetrics,
): AdaptationResult {
  const session = cloneSession(planned);
  const changes: AdaptationChange[] = [];
  let warmupMandatory = false;

  // Rule 1 — sharp pain (highest priority).
  const painPart = firstFlagged(checkIn.pain);
  if (painPart) {
    warmupMandatory = true;
    scaleMainVolume(session, 0.5);
    // Remove crimp/loaded grip from main work; force open-hand.
    for (const b of session.blocks) {
      if (b.category === 'main' && b.grip !== 'open-hand') b.grip = 'open-hand';
    }
    session.blocks.push(prehabBlock());
    changes.push({
      ruleId: 'pain',
      reason: `${PART_LABEL[painPart]} pain flagged — cut volume 50%, open-hand only, added prehab. See a physio if it persists.`,
    });
    return { adjustedSession: session, changes, warmupMandatory };
  }

  // Rule 2 — soreness (no sharp pain).
  const sorePart = firstFlagged(checkIn.soreness);
  if (sorePart) {
    warmupMandatory = true;
    for (const b of mainBlocks(session)) {
      if (b.grip === 'crimp' || b.grip === 'mixed') b.grip = 'open-hand';
      b.targetRPE = Math.max(5, b.targetRPE - 1);
    }
    changes.push({
      ruleId: 'soreness',
      reason: `${PART_LABEL[sorePart]} sore — switched to open-hand and dialled intensity back one notch.`,
    });
  }

  // Rule 3 — ACWR high → force deload.
  if (metrics.acwr > 1.5) {
    scaleMainVolume(session, 0.6);
    for (const b of mainBlocks(session)) b.targetRPE = Math.min(b.targetRPE, 6);
    changes.push({
      ruleId: 'acwr-high',
      reason: `Load ratio hit ${metrics.acwr} — deloading (volume −40%, easy intensity) to avoid injury.`,
    });
    return { adjustedSession: session, changes, warmupMandatory };
  }

  // Rule 4 — ACWR caution band → cap intensity.
  if (metrics.acwr >= 1.3) {
    for (const b of mainBlocks(session)) b.targetRPE = Math.min(b.targetRPE, 8);
    changes.push({
      ruleId: 'acwr-caution',
      reason: `Load creeping up (ratio ${metrics.acwr}) — holding intensity steady, no new max attempts.`,
    });
  }

  // Rule 5 — fatigue / poor sleep.
  if (checkIn.overallFatigue >= 4 || checkIn.sleepQuality <= 2) {
    scaleMainVolume(session, 0.8);
    for (const b of mainBlocks(session)) b.targetRPE = Math.max(5, b.targetRPE - 1);
    changes.push({
      ruleId: 'fatigue',
      reason: 'Rough sleep / high fatigue — trimmed volume ~20% and lowered the RPE target.',
    });
  }

  return { adjustedSession: session, changes, warmupMandatory };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test adaptation`
Expected: PASS (9 tests).

- [ ] **Step 5: Run the whole domain suite**

Run: `pnpm test`
Expected: PASS — all domain tests green.

- [ ] **Step 6: Commit**

```bash
git add src/domain/adaptation.ts tests/domain/adaptation.test.ts
git commit -m "feat(domain): adaptive rules engine (safety-first)"
```

---

## Task 7: Repository interface

**Files:**

- Create: `boulder-coach/src/data/IClimbRepo.ts`

- [ ] **Step 1: Write the interface**

Create `src/data/IClimbRepo.ts`:

```ts
import type { CheckIn, Program, SessionLog, UserProfile } from '@/domain/types';

/**
 * Storage seam. The Dexie impl backs this now; a cloud impl can replace it
 * later without touching domain or UI code.
 */
export interface IClimbRepo {
  getProfile(): Promise<UserProfile | undefined>;
  saveProfile(profile: UserProfile): Promise<void>;

  getActiveProgram(): Promise<Program | undefined>;
  saveProgram(program: Program): Promise<void>;

  getCheckIn(dateIso: string): Promise<CheckIn | undefined>;
  saveCheckIn(checkIn: CheckIn): Promise<void>;

  getLogs(): Promise<SessionLog[]>;
  saveLog(log: SessionLog): Promise<void>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/data/IClimbRepo.ts && git commit -m "feat(data): repository interface (storage seam)"
```

---

## Task 8: Dexie (IndexedDB) repository implementation

**Files:**

- Create: `boulder-coach/src/data/dexieRepo.ts`
- Test: `boulder-coach/tests/domain/dexieRepo.test.ts`

> Dexie is browser IndexedDB. For the unit test we use the in-memory `fake-indexeddb` shim so the repo can be exercised in Node.

- [ ] **Step 1: Add the test shim dependency**

```bash
cd boulder-coach && pnpm add -D fake-indexeddb
```

Expected: installs, exit 0.

- [ ] **Step 2: Write the failing test**

Create `tests/domain/dexieRepo.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { DexieClimbRepo } from '../../src/data/dexieRepo';
import type { UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5,
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

describe('DexieClimbRepo', () => {
  let repo: DexieClimbRepo;

  beforeEach(async () => {
    repo = new DexieClimbRepo(`test-db-${Math.random()}`);
  });

  it('round-trips the profile', async () => {
    expect(await repo.getProfile()).toBeUndefined();
    await repo.saveProfile(profile);
    expect(await repo.getProfile()).toEqual(profile);
  });

  it('overwrites profile on re-save (single profile)', async () => {
    await repo.saveProfile(profile);
    await repo.saveProfile({ ...profile, currentGrade: 6 });
    expect((await repo.getProfile())?.currentGrade).toBe(6);
  });

  it('accumulates logs', async () => {
    await repo.saveLog({
      id: 'l1',
      date: '2026-06-09',
      warmupCompleted: true,
      blocks: [],
      sessionRPE: 8,
      durationMin: 60,
    });
    await repo.saveLog({
      id: 'l2',
      date: '2026-06-11',
      warmupCompleted: true,
      blocks: [],
      sessionRPE: 7,
      durationMin: 50,
    });
    expect(await repo.getLogs()).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test dexieRepo`
Expected: FAIL — cannot find module `dexieRepo`.

- [ ] **Step 4: Write minimal implementation**

Create `src/data/dexieRepo.ts`:

```ts
import Dexie, { type Table } from 'dexie';
import type { CheckIn, Program, SessionLog, UserProfile } from '@/domain/types';
import type { IClimbRepo } from './IClimbRepo';

interface ProfileRow extends UserProfile {
  id: 'singleton';
}
interface ProgramRow {
  id: string;
  active: number; // 1 = active
  program: Program;
}
interface CheckInRow {
  date: string;
  checkIn: CheckIn;
}

class ClimbDB extends Dexie {
  profile!: Table<ProfileRow, string>;
  programs!: Table<ProgramRow, string>;
  checkIns!: Table<CheckInRow, string>;
  logs!: Table<SessionLog, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      programs: 'id, active',
      checkIns: 'date',
      logs: 'id, date',
    });
  }
}

export class DexieClimbRepo implements IClimbRepo {
  private db: ClimbDB;

  constructor(dbName = 'boulder-coach') {
    this.db = new ClimbDB(dbName);
  }

  async getProfile(): Promise<UserProfile | undefined> {
    const row = await this.db.profile.get('singleton');
    if (!row) return undefined;
    const { id: _id, ...profile } = row;
    return profile;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.db.profile.put({ id: 'singleton', ...profile });
  }

  async getActiveProgram(): Promise<Program | undefined> {
    const row = await this.db.programs.where('active').equals(1).first();
    return row?.program;
  }

  async saveProgram(program: Program): Promise<void> {
    await this.db.transaction('rw', this.db.programs, async () => {
      await this.db.programs.toCollection().modify({ active: 0 });
      await this.db.programs.put({ id: program.id, active: 1, program });
    });
  }

  async getCheckIn(dateIso: string): Promise<CheckIn | undefined> {
    const row = await this.db.checkIns.get(dateIso);
    return row?.checkIn;
  }

  async saveCheckIn(checkIn: CheckIn): Promise<void> {
    await this.db.checkIns.put({ date: checkIn.date, checkIn });
  }

  async getLogs(): Promise<SessionLog[]> {
    return this.db.logs.toArray();
  }

  async saveLog(log: SessionLog): Promise<void> {
    await this.db.logs.put(log);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test dexieRepo`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/dexieRepo.ts tests/domain/dexieRepo.test.ts package.json
git commit -m "feat(data): Dexie/IndexedDB repository impl"
```

---

## Task 9: Bootstrap (wire domain + repo into "today's session")

**Files:**

- Create: `boulder-coach/src/app/lib/bootstrap.ts`
- Test: `boulder-coach/tests/domain/bootstrap.test.ts`

This is the orchestration the UI calls: ensure a profile + program exist, then compute today's adapted session.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/bootstrap.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DexieClimbRepo } from '../../src/data/dexieRepo';
import { getTodaySession, DEFAULT_PROFILE } from '../../src/app/lib/bootstrap';

describe('getTodaySession', () => {
  it('creates a profile + program on first run and returns an adapted session', async () => {
    const repo = new DexieClimbRepo(`boot-${Math.random()}`);
    const result = await getTodaySession(repo, new Date('2026-06-09'));

    expect(await repo.getProfile()).toEqual(DEFAULT_PROFILE);
    expect(await repo.getActiveProgram()).toBeDefined();
    expect(result.session.blocks.length).toBeGreaterThan(0);
    expect(Array.isArray(result.changes)).toBe(true);
  });

  it('reuses the existing program on subsequent runs', async () => {
    const repo = new DexieClimbRepo(`boot-${Math.random()}`);
    await getTodaySession(repo, new Date('2026-06-09'));
    const firstProgram = await repo.getActiveProgram();
    await getTodaySession(repo, new Date('2026-06-10'));
    const secondProgram = await repo.getActiveProgram();
    expect(secondProgram?.id).toBe(firstProgram?.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test bootstrap`
Expected: FAIL — cannot find module `bootstrap`.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/lib/bootstrap.ts`:

```ts
import type { AdaptationChange, CheckIn, PlannedSession, UserProfile } from '@/domain/types';
import type { IClimbRepo } from '@/data/IClimbRepo';
import { generateProgram } from '@/domain/periodization';
import { computeLoadMetrics } from '@/domain/loadMetrics';
import { adapt } from '@/domain/adaptation';

export const DEFAULT_PROFILE: UserProfile = {
  currentGrade: 5, // V5, mid plateau zone
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

export interface TodayResult {
  session: PlannedSession;
  changes: AdaptationChange[];
  warmupMandatory: boolean;
}

function neutralCheckIn(dateIso: string): CheckIn {
  return {
    date: dateIso,
    sleepQuality: 4,
    overallFatigue: 2,
    soreness: {},
    pain: {},
    motivation: 4,
  };
}

/** Day index into the current week's session rotation. */
function pickPlannedSession(sessions: PlannedSession[], asOf: Date): PlannedSession {
  if (sessions.length === 0) throw new Error('program week has no sessions');
  const idx = asOf.getDay() % sessions.length;
  return sessions[idx];
}

export async function getTodaySession(
  repo: IClimbRepo,
  asOf: Date = new Date(),
): Promise<TodayResult> {
  let profile = await repo.getProfile();
  if (!profile) {
    profile = DEFAULT_PROFILE;
    await repo.saveProfile(profile);
  }

  let program = await repo.getActiveProgram();
  if (!program) {
    program = generateProgram(profile, asOf.toISOString().slice(0, 10));
    await repo.saveProgram(program);
  }

  const week = program.weeks[program.currentWeekIndex] ?? program.weeks[0];
  const planned = pickPlannedSession(week.sessions, asOf);

  const dateIso = asOf.toISOString().slice(0, 10);
  const checkIn = (await repo.getCheckIn(dateIso)) ?? neutralCheckIn(dateIso);
  const metrics = computeLoadMetrics(await repo.getLogs(), asOf);

  const { adjustedSession, changes, warmupMandatory } = adapt(
    planned,
    checkIn,
    await repo.getLogs(),
    metrics,
  );

  return { session: adjustedSession, changes, warmupMandatory };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test bootstrap`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/bootstrap.ts tests/domain/bootstrap.test.ts
git commit -m "feat: bootstrap today's adapted session (domain + repo wiring)"
```

---

## Task 10: "Today" screen

**Files:**

- Modify: `boulder-coach/src/app/page.tsx`

This is a client component (IndexedDB is browser-only). It calls `getTodaySession` and renders the session + any adaptation reasons.

- [ ] **Step 1: Replace the default page**

Replace the entire contents of `src/app/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';

export default function TodayPage() {
  const [today, setToday] = useState<TodayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repo = new DexieClimbRepo();
    getTodaySession(repo)
      .then(setToday)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load session'));
  }, []);

  if (error) {
    return <main className="p-6 text-red-600">Error: {error}</main>;
  }
  if (!today) {
    return <main className="p-6">Loading today’s session…</main>;
  }

  const { session, changes, warmupMandatory } = today;

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-gray-500 capitalize">{session.type.replace('-', ' ')}</p>
      </header>

      {changes.length > 0 && (
        <section className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 space-y-1">
          <p className="font-semibold">Adjusted for you:</p>
          {changes.map((c) => (
            <p key={c.ruleId}>• {c.reason}</p>
          ))}
        </section>
      )}

      {warmupMandatory && (
        <p className="rounded bg-red-100 px-3 py-2 text-sm font-medium text-red-800">
          Warm-up is mandatory today.
        </p>
      )}

      <ol className="space-y-3">
        {session.blocks.map((b) => (
          <li key={b.id} className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{b.name}</span>
              <span className="text-xs uppercase text-gray-400">{b.category}</span>
            </div>
            <p className="text-sm text-gray-600">
              {b.sets} × {b.grip}
              {b.targetGrade !== undefined ? ` · V${b.targetGrade}` : ''} · RPE {b.targetRPE}
            </p>
            {b.notes && <p className="mt-1 text-xs text-gray-500">{b.notes}</p>}
          </li>
        ))}
      </ol>
    </main>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `pnpm build`
Expected: build succeeds, exit 0.

- [ ] **Step 3: Manual smoke test**

Run: `pnpm dev`, open `http://localhost:3000`.
Expected: "Today" renders a session with warm-up → main → cooldown blocks. (No adaptation banner on a neutral first run.)

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx && git commit -m "feat(ui): minimal Today screen wired to domain engine"
```

---

## Task 11: Make it installable (basic PWA manifest)

**Files:**

- Create: `boulder-coach/public/manifest.webmanifest`
- Modify: `boulder-coach/src/app/layout.tsx`

> Offline service-worker caching is deferred to Plan 3. This task only adds installability metadata.

- [ ] **Step 1: Add the manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Boulder Coach",
  "short_name": "Boulder",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": []
}
```

- [ ] **Step 2: Reference it from the layout metadata**

In `src/app/layout.tsx`, add to the exported `metadata` object:

```ts
export const metadata = {
  title: 'Boulder Coach',
  description: 'Your adaptive bouldering training program',
  manifest: '/manifest.webmanifest',
};
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: build succeeds, exit 0.

- [ ] **Step 4: Commit**

```bash
git add public/manifest.webmanifest src/app/layout.tsx
git commit -m "feat(pwa): installable manifest"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `pnpm test`
Expected: all suites PASS — loadMetrics (4), warmup (3), periodization (5), adaptation (9), dexieRepo (3), bootstrap (2).

- [ ] **Type-check + build**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: exit 0.

---

## Plan Self-Review

**Spec coverage:**

- Layered architecture (domain pure / repo seam) → Tasks 2–9 ✅
- Data model entities → Task 2 (types) + Task 8 (persistence) ✅
- 6-week waved periodization, session types scale 2–4/week → Task 5 ✅
- RAMP warm-up, open-hand first, extra mobilization on injury → Task 4 ✅
- ACWR / sRPE load math (0.8–1.3 band, >1.5 deload) → Task 3 + adaptation rules 3–4 ✅
- Adaptive rules engine, safety-first ordering, human reasons → Task 6 ✅
- Today screen (hero session + adaptation banner) → Task 10 ✅
- Local-first storage, swappable for cloud → Tasks 7–8 ✅
- Installable PWA → Task 11 ✅
- **Deferred to later plans (noted in spec non-goals / decomposition):** full check-in UI, session player logging, insights, history, program calendar, drills library, offline service worker. These are Plans 2 & 3.

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✅

**Type consistency:** `IClimbRepo` methods match `DexieClimbRepo` impl and `bootstrap` calls (`getProfile/saveProfile/getActiveProgram/saveProgram/getCheckIn/saveCheckIn/getLogs/saveLog`). `adapt()` signature `(planned, checkIn, recentLogs, metrics)` matches its test and the bootstrap call. `generateProgram(profile, startDate)` consistent across periodization test and bootstrap. `AdaptationResult` fields (`adjustedSession`, `changes`, `warmupMandatory`) consistent across types, engine, bootstrap, and UI. ✅
