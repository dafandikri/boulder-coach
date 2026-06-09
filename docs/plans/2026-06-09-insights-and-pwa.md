# Plan 3 — Insights, History, Program Calendar, Drills, PWA Offline

> **For agentic workers:** Read `skills/passing-the-gate.md` and `skills/test-driven-development.md` before coding. Steps use checkbox (`- [ ]`) tracking. `pnpm gate` must be green before every commit; commit per task; commit -m uses conventional commits.

**Goal:** Close the feedback loop — show ACWR trends, grade progression, soreness history, the 6-week program calendar, a drill library, and make the app work offline.

**Architecture:** All hard work is done (domain engine, storage, check-in, session player). Plan 3 is mostly read-only UI over existing data, plus two small pure domain helpers (insights, drills seed data) and a service worker for offline.

**Source spec:** `docs/specs/2026-06-09-bouldering-coach-app-design.md` (screens 4–7, PWA offline).

---

## File Structure

```
src/
  domain/
    insights.ts             # NEW: computeTrends, gradePyramid, sorenessTrends
    drills.ts               # NEW: seeded drill library
  app/
    page.tsx                # MODIFY: add nav links to /history, /insights, /program, /drills
    history/page.tsx        # NEW: past sessions list
    insights/page.tsx       # NEW: ACWR gauge + grade pyramid + soreness chart
    program/page.tsx        # NEW: 6-week calendar
    drills/page.tsx         # NEW: technique + prehab library
  data/
    IClimbRepo.ts           # MODIFY: add getCheckIns (all)
    dexieRepo.ts            # MODIFY: implement getCheckIns
public/
  sw.js                     # NEW: service worker for offline cache
tests/
  domain/
    insights.test.ts        # NEW
    drills.test.ts          # NEW
e2e/
  plan3.spec.ts             # NEW: smoke all new routes
```

---

## Task 1: Domain — Insights helpers (pure)

**Files:** Create `src/domain/insights.ts`; Create `tests/domain/insights.test.ts`.

Pure functions that derive summary data from logs and check-ins.

```ts
import type { SessionLog, CheckIn, VGrade, BodyPart } from './types';

export interface GradePyramidEntry {
  grade: VGrade;
  count: number;
}

export interface SorenessTrend {
  date: string;
  bodyPart: BodyPart;
  severity: number;
  type: 'soreness' | 'pain';
}

export interface Insights {
  gradePyramid: GradePyramidEntry[];
  sorenessTrends: SorenessTrend[];
  totalSessions: number;
  averageSessionRPE: number;
}

export function computeInsights(logs: SessionLog[], checkIns: CheckIn[]): Insights {
  const gradePyramid = buildGradePyramid(logs);
  const sorenessTrends = buildSorenessTrends(checkIns);
  const totalSessions = logs.length;
  const avgRpe =
    logs.length > 0
      ? Math.round((logs.reduce((s, l) => s + l.sessionRPE, 0) / logs.length) * 10) / 10
      : 0;
  return { gradePyramid, sorenessTrends, totalSessions, averageSessionRPE: avgRpe };
}

function buildGradePyramid(logs: SessionLog[]): GradePyramidEntry[] {
  const map = new Map<VGrade, number>();
  for (const log of logs) {
    for (const b of log.blocks) {
      for (const g of b.gradesSent) {
        map.set(g, (map.get(g) ?? 0) + 1);
      }
    }
  }
  return [...map.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => a.grade - b.grade);
}

function buildSorenessTrends(checkIns: CheckIn[]): SorenessTrend[] {
  const trends: SorenessTrend[] = [];
  for (const ci of checkIns) {
    for (const [bodyPart, severity] of Object.entries(ci.soreness)) {
      if (severity)
        trends.push({ date: ci.date, bodyPart: bodyPart as BodyPart, severity, type: 'soreness' });
    }
    for (const [bodyPart, severity] of Object.entries(ci.pain)) {
      if (severity)
        trends.push({ date: ci.date, bodyPart: bodyPart as BodyPart, severity, type: 'pain' });
    }
  }
  return trends.sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 1:** Write test `tests/domain/insights.test.ts`
- [ ] **Step 2:** Run — expect FAIL
- [ ] **Step 3:** Implement `src/domain/insights.ts`
- [ ] **Step 4:** `pnpm gate` green
- [ ] **Step 5:** Commit

---

## Task 2: Domain — Drills seed library (pure)

**Files:** Create `src/domain/drills.ts`; Create `tests/domain/drills.test.ts`.

Seeded data module — no storage needed, just exported constants.

```ts
export type SkillCategory = 'technique' | 'prehab';

export interface Drill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  cues: string[];
}

export const DRILLS: Drill[] = [
  {
    id: 'drill-footwork-silent',
    name: 'Silent feet',
    category: 'technique',
    description: 'Place each foot precisely with no sound. Repeat until silent.',
    cues: ['Watch your feet land', 'Slow down the placement', 'No scuffing'],
  },
  {
    id: 'drill-footwork-deadpoint',
    name: 'Deadpoint practice',
    category: 'technique',
    description: 'Find a lock-off move; practice hitting the hold at the apex of motion.',
    cues: ['Stretch through the toe', 'One smooth motion', 'Catch and stick'],
  },
  {
    id: 'drill-technique-smear',
    name: 'Smear & trust',
    category: 'technique',
    description: 'Climb a slab or vertical section focusing on smearing.',
    cues: ['Rubber to wall', 'Hips in', 'Weight over the foot'],
  },
  {
    id: 'drill-prehab-ecu',
    name: 'ECU pronation',
    category: 'prehab',
    description: 'Wrist-strengthening for TFCC: pronation with a light band or bottle.',
    cues: ['Slow eccentric', 'Full range of motion', 'No pain'],
  },
  {
    id: 'drill-prehab-shoulder',
    name: 'Band pull-apart',
    category: 'prehab',
    description: 'Standing band pull-apart for rear delt and scapular control.',
    cues: ['Squeeze shoulder blades', 'Straight arms', 'Slow return'],
  },
  {
    id: 'drill-prehab-finger',
    name: 'Tendon glide',
    category: 'prehab',
    description: 'Finger tendon glide sequence: straight hook → full fist → straight.',
    cues: ['Slow and controlled', 'Full extension each rep', 'No pain'],
  },
];

export function getDrillsByCategory(category: SkillCategory): Drill[] {
  return DRILLS.filter((d) => d.category === category);
}

export function getDrill(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}
```

- [ ] **Step 1:** Write test `tests/domain/drills.test.ts`
- [ ] **Step 2:** Run — expect FAIL
- [ ] **Step 3:** Implement `src/domain/drills.ts`
- [ ] **Step 4:** `pnpm gate` green
- [ ] **Step 5:** Commit

---

## Task 3: Repo — add `getCheckIns`

**Files:** Modify `src/data/IClimbRepo.ts`; Modify `src/data/dexieRepo.ts`.

The Insights screen needs all check-ins (not just one by date). Add to the interface and Dexie impl.

- [ ] **Step 1:** Add `getCheckIns(): Promise<CheckIn[]>` to `IClimbRepo`
- [ ] **Step 2:** Implement in `dexieRepo.ts`
- [ ] **Step 3:** `pnpm gate` green
- [ ] **Step 4:** Commit

---

## Task 4: History screen (`/history`)

**Files:** Create `src/app/history/page.tsx`.

Lists past sessions with date, type, RPE, duration — reverse chronological.

- [ ] **Step 1:** Implement
- [ ] **Step 2:** `pnpm gate` green
- [ ] **Step 3:** Commit

---

## Task 5: Insights screen (`/insights`)

**Files:** Create `src/app/insights/page.tsx`.

Shows: ACWR reading (color gauge), grade pyramid (bar list), soreness trend timeline, total sessions + avg RPE.

- [ ] **Step 1:** Implement
- [ ] **Step 2:** `pnpm gate` green
- [ ] **Step 3:** Commit

---

## Task 6: Program calendar (`/program`)

**Files:** Create `src/app/program/page.tsx`.

6-week calendar showing phases (hard/peak/deload) + current position indicator.

- [ ] **Step 1:** Implement
- [ ] **Step 2:** `pnpm gate` green
- [ ] **Step 3:** Commit

---

## Task 7: Drills library (`/drills`)

**Files:** Create `src/app/drills/page.tsx`.

Two tabs: Technique / Prehab. Lists drills from the seed data with descriptions + cues.

- [ ] **Step 1:** Implement
- [ ] **Step 2:** `pnpm gate` green
- [ ] **Step 3:** Commit

---

## Task 8: Navigation — wire all new screens from Today

**Files:** Modify `src/app/page.tsx`.

Add links to /history, /insights, /program, /drills in the Today screen footer.

- [ ] **Step 1:** Add nav links
- [ ] **Step 2:** `pnpm gate` green
- [ ] **Step 3:** Commit

---

## Task 9: PWA offline — service worker

**Files:** Create `public/sw.js`; Modify `src/app/layout.tsx`.

Register a service worker that caches the app shell + static assets for offline use.

- [ ] **Step 1:** Create `public/sw.js` with cache-first strategy for static assets, network-first for API
- [ ] **Step 2:** Register in `layout.tsx` (only on client)
- [ ] **Step 3:** `pnpm gate` green
- [ ] **Step 4:** Commit

---

## Task 10: E2E smoke for new routes

**Files:** Create `e2e/plan3.spec.ts`.

- [ ] **Step 1:** Write Playwright test: boots /history, /insights, /program, /drills
- [ ] **Step 2:** `pnpm gate` green; `pnpm e2e` passes
- [ ] **Step 3:** Commit

---

## Final verification

- [ ] `pnpm gate` green; `pnpm e2e` green
- [ ] All 7 spec screens exist and render
- [ ] App boots offline (service worker registered)
