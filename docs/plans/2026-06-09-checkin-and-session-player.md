# Plan 2 — Check-in Flow + Session Player + Logging

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or executing-plans). Read `skills/passing-the-gate.md` and `skills/test-driven-development.md` before coding. Steps use checkbox (`- [ ]`) tracking. `pnpm gate` must be green before every commit; commit per task; never push.

**Goal:** Close the daily loop — the user does a 30-second check-in (which feeds the adaptive engine), starts today's session, logs what they actually did block-by-block, and that log feeds back into load metrics (ACWR) for tomorrow.

**Architecture:** The domain + storage already support this (the `adapt()` engine consumes a `CheckIn`; `computeLoadMetrics` consumes `SessionLog[]`; `IClimbRepo` has `saveCheckIn`/`getCheckIn`/`saveLog`/`getLogs`). Plan 2 adds (a) one pure domain helper to assemble a `SessionLog` from raw block actuals, and (b) two client screens (Check-in, Session player) plus navigation from Today. UI is browser-only (IndexedDB), so screens are `'use client'`.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Tailwind v4, Dexie, Vitest, Playwright. Same gate as Plan 1.

**Source spec:** `docs/specs/2026-06-09-bouldering-coach-app-design.md` (screens 2 & 3, data model `CheckIn`/`SessionLog`/`LoggedBlock`).

---

## File Structure

```
src/
  domain/
    sessionLog.ts          # NEW pure helper: assemble a SessionLog + suggest sessionRPE
  app/
    page.tsx               # MODIFY: add links to /checkin (check-in) and /session (Start)
    checkin/page.tsx       # NEW: 30s check-in → repo.saveCheckIn → back to Today
    session/page.tsx       # NEW: session player → log actuals → repo.saveLog
    lib/
      bootstrap.ts         # (exists) reused to load today's adapted session
tests/
  domain/
    sessionLog.test.ts     # NEW
e2e/
  flow.spec.ts             # NEW: smoke the /checkin and /session routes boot
```

**Rationale:** Only the pure logic (`sessionLog.ts`) needs coverage; the screens are exercised by Playwright. Keeping `createSessionLog` pure means the "what gets persisted" rule is unit-tested and the UI just collects inputs.

---

## Task 1: Domain — `createSessionLog` + `suggestSessionRPE` (pure)

**Files:** Create `src/domain/sessionLog.ts`; Create `tests/domain/sessionLog.test.ts`.

- [ ] **Step 1: Failing test**

Create `tests/domain/sessionLog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createSessionLog, suggestSessionRPE } from '../../src/domain/sessionLog';
import type { BlockActual } from '../../src/domain/sessionLog';

const actuals: BlockActual[] = [
  { blockId: 'm', setsCompleted: 5, gradesAttempted: [5, 5, 6], gradesSent: [5], rpe: 9 },
  { blockId: 'cd', setsCompleted: 2, gradesAttempted: [], gradesSent: [], rpe: 4 },
];

describe('suggestSessionRPE', () => {
  it('returns 0 with no blocks', () => {
    expect(suggestSessionRPE([])).toBe(0);
  });
  it('suggests the hardest block RPE as the session RPE', () => {
    expect(suggestSessionRPE(actuals)).toBe(9);
  });
});

describe('createSessionLog', () => {
  it('assembles a SessionLog with an id, mapped blocks, and the given metadata', () => {
    const log = createSessionLog({
      date: '2026-06-09',
      plannedSessionId: 's1',
      warmupCompleted: true,
      blocks: actuals,
      sessionRPE: 8,
      durationMin: 65,
      notes: 'felt strong',
    });
    expect(log.id).toBe('log-2026-06-09');
    expect(log.date).toBe('2026-06-09');
    expect(log.plannedSessionId).toBe('s1');
    expect(log.warmupCompleted).toBe(true);
    expect(log.blocks).toHaveLength(2);
    expect(log.blocks[0]!.gradesSent).toEqual([5]);
    expect(log.sessionRPE).toBe(8);
    expect(log.durationMin).toBe(65);
    expect(log.notes).toBe('felt strong');
  });

  it('falls back to the suggested session RPE when none is given', () => {
    const log = createSessionLog({
      date: '2026-06-10',
      warmupCompleted: false,
      blocks: actuals,
      durationMin: 40,
    });
    expect(log.sessionRPE).toBe(9); // suggested from blocks
    expect(log.plannedSessionId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm exec vitest run sessionLog`): cannot find module.

- [ ] **Step 3: Implement** `src/domain/sessionLog.ts`:

```ts
import type { LoggedBlock, SessionLog, VGrade } from './types';

export interface BlockActual {
  blockId: string;
  setsCompleted: number;
  gradesAttempted: VGrade[];
  gradesSent: VGrade[];
  rpe: number; // 1..10
}

export interface SessionLogInput {
  date: string; // ISO yyyy-mm-dd
  plannedSessionId?: string;
  warmupCompleted: boolean;
  blocks: BlockActual[];
  /** Overall session RPE (1..10). If omitted, the hardest block RPE is used. */
  sessionRPE?: number;
  durationMin: number;
  notes?: string;
}

/** sRPE proxy: the session is as hard as its hardest block. */
export function suggestSessionRPE(blocks: { rpe: number }[]): number {
  return blocks.reduce((max, b) => Math.max(max, b.rpe), 0);
}

export function createSessionLog(input: SessionLogInput): SessionLog {
  const blocks: LoggedBlock[] = input.blocks.map((b) => ({
    blockId: b.blockId,
    setsCompleted: b.setsCompleted,
    gradesAttempted: b.gradesAttempted,
    gradesSent: b.gradesSent,
    rpe: b.rpe,
  }));
  return {
    id: `log-${input.date}`,
    date: input.date,
    plannedSessionId: input.plannedSessionId,
    warmupCompleted: input.warmupCompleted,
    blocks,
    sessionRPE: input.sessionRPE ?? suggestSessionRPE(input.blocks),
    durationMin: input.durationMin,
    notes: input.notes,
  };
}
```

- [ ] **Step 4: Run — expect PASS** (`pnpm exec vitest run sessionLog`), then `pnpm gate` green.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(domain): session log assembler + sRPE suggestion"`.

---

## Task 2: Check-in screen (`/checkin`)

**Files:** Create `src/app/checkin/page.tsx`.

A 30-second check-in: sleep & fatigue & motivation sliders (1–5) + tap body parts (pip / wrist-tfcc / shoulder / elbow) to flag soreness and (separately) pain. Saves a `CheckIn` for today via the repo, then navigates back to Today (which re-runs the engine and reflects the adaptation).

- [ ] **Step 1: Implement** `src/app/checkin/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import type { BodyPart, CheckIn } from '@/domain/types';

const PARTS: { key: BodyPart; label: string }[] = [
  { key: 'pip', label: 'Finger (PIP)' },
  { key: 'wrist-tfcc', label: 'Wrist (TFCC)' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'elbow', label: 'Elbow' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CheckInPage() {
  const router = useRouter();
  const [sleepQuality, setSleep] = useState(4);
  const [overallFatigue, setFatigue] = useState(2);
  const [motivation, setMotivation] = useState(4);
  const [soreness, setSoreness] = useState<Partial<Record<BodyPart, number>>>({});
  const [pain, setPain] = useState<Partial<Record<BodyPart, number>>>({});
  const [saving, setSaving] = useState(false);

  function toggle(
    map: Partial<Record<BodyPart, number>>,
    set: (m: Partial<Record<BodyPart, number>>) => void,
    key: BodyPart,
  ): void {
    const next = { ...map };
    if (next[key]) delete next[key];
    else next[key] = 2;
    set(next);
  }

  async function save(): Promise<void> {
    setSaving(true);
    const checkIn: CheckIn = {
      date: todayIso(),
      sleepQuality,
      overallFatigue,
      motivation,
      soreness,
      pain,
    };
    await new DexieClimbRepo().saveCheckIn(checkIn);
    router.push('/');
  }

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">Check-in</h1>

      {(
        [
          ['Sleep', sleepQuality, setSleep],
          ['Fatigue', overallFatigue, setFatigue],
          ['Motivation', motivation, setMotivation],
        ] as const
      ).map(([label, value, set]) => (
        <label key={label} className="block">
          <span className="text-sm font-medium">
            {label}: {value}
          </span>
          <input
            type="range"
            min={1}
            max={5}
            value={value}
            onChange={(e) => {
              set(Number(e.target.value));
            }}
            className="w-full"
          />
        </label>
      ))}

      <Section
        title="Soreness (tap)"
        map={soreness}
        onToggle={(k) => {
          toggle(soreness, setSoreness, k);
        }}
      />
      <Section
        title="Pain (tap)"
        map={pain}
        onToggle={(k) => {
          toggle(pain, setPain, k);
        }}
      />

      <button
        onClick={() => void save()}
        disabled={saving}
        className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save check-in'}
      </button>
    </main>
  );
}

function Section({
  title,
  map,
  onToggle,
}: {
  title: string;
  map: Partial<Record<BodyPart, number>>;
  onToggle: (key: BodyPart) => void;
}) {
  return (
    <section>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {PARTS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              onToggle(p.key);
            }}
            className={`rounded-lg border px-3 py-2 text-sm ${map[p.key] ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-300'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2:** `pnpm gate` green (read `skills/passing-the-gate.md` if lint flags the event handlers — wrap async in `void`, type `e` as the change event). Build must pass.
- [ ] **Step 3: Commit** `git commit -m "feat(ui): 30-second check-in screen"`.

---

## Task 3: Today screen — navigation to check-in & session

**Files:** Modify `src/app/page.tsx`.

- [ ] **Step 1:** Add two links to the Today header area: a "Check-in" link to `/checkin` and a "Start session" link to `/session`. Use `next/link`:

```tsx
import Link from 'next/link';
// …inside <main>, under the <header>:
<div className="flex gap-3">
  <Link href="/checkin" className="rounded-lg border px-4 py-2 text-sm font-medium">
    Check-in
  </Link>
  <Link
    href="/session"
    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
  >
    Start session
  </Link>
</div>;
```

- [ ] **Step 2:** `pnpm gate` green. **Step 3: Commit** `git commit -m "feat(ui): link Today to check-in and session player"`.

---

## Task 4: Session player (`/session`)

**Files:** Create `src/app/session/page.tsx`.

Loads today's adapted session (via `getTodaySession`), shows the warm-up checklist + each block with its targets, lets the user record per-block actuals (sets completed, grades sent, RPE) and a duration, then assembles a `SessionLog` with `createSessionLog` and saves it via the repo, returning to Today.

- [ ] **Step 1: Implement** `src/app/session/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';
import { createSessionLog, type BlockActual } from '@/domain/sessionLog';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SessionPage() {
  const router = useRouter();
  const [today, setToday] = useState<TodayResult | null>(null);
  const [actuals, setActuals] = useState<Record<string, BlockActual>>({});
  const [durationMin, setDuration] = useState(60);

  useEffect(() => {
    void getTodaySession(new DexieClimbRepo()).then((t) => {
      setToday(t);
      const seed: Record<string, BlockActual> = {};
      for (const b of t.session.blocks) {
        seed[b.id] = {
          blockId: b.id,
          setsCompleted: b.sets,
          gradesAttempted: [],
          gradesSent: [],
          rpe: b.targetRPE,
        };
      }
      setActuals(seed);
    });
  }, []);

  if (!today) return <main className="p-6">Loading…</main>;

  function setRpe(blockId: string, rpe: number): void {
    setActuals((a) => ({ ...a, [blockId]: { ...a[blockId]!, rpe } }));
  }

  async function finish(): Promise<void> {
    const log = createSessionLog({
      date: todayIso(),
      plannedSessionId: today!.session.id,
      warmupCompleted: true,
      blocks: Object.values(actuals),
      durationMin,
    });
    await new DexieClimbRepo().saveLog(log);
    router.push('/');
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Session</h1>
      <ol className="space-y-3">
        {today.session.blocks.map((b) => (
          <li key={b.id} className="rounded-lg border p-4">
            <p className="font-medium">{b.name}</p>
            <p className="text-sm text-gray-600">
              target: {b.sets} × {b.grip} · RPE {b.targetRPE}
            </p>
            <label className="mt-2 block text-sm">
              Your RPE: {actuals[b.id]?.rpe ?? b.targetRPE}
              <input
                type="range"
                min={1}
                max={10}
                value={actuals[b.id]?.rpe ?? b.targetRPE}
                onChange={(e) => {
                  setRpe(b.id, Number(e.target.value));
                }}
                className="w-full"
              />
            </label>
          </li>
        ))}
      </ol>
      <label className="block text-sm">
        Duration (min): {durationMin}
        <input
          type="range"
          min={20}
          max={150}
          step={5}
          value={durationMin}
          onChange={(e) => {
            setDuration(Number(e.target.value));
          }}
          className="w-full"
        />
      </label>
      <button
        onClick={() => void finish()}
        className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white"
      >
        Finish & log session
      </button>
    </main>
  );
}
```

- [ ] **Step 2:** `pnpm gate` green. Watch for strict-lint on event handlers and `actuals[b.id]!` (in `src` you cannot use `!` — guard or use `?? fallback`; the code above uses `?? b.targetRPE` reads and `a[blockId]!` inside a setter where the key is known — if lint flags it, narrow with a local `const cur = a[blockId]; if (!cur) return a;`). Apply the `skills/passing-the-gate.md` rules.
- [ ] **Step 3: Commit** `git commit -m "feat(ui): session player logs actuals to a SessionLog"`.

---

## Task 5: E2E smoke for the new routes

**Files:** Create `e2e/flow.spec.ts`.

- [ ] **Step 1:**

```ts
import { test, expect } from '@playwright/test';

test('check-in and session routes boot', async ({ page }) => {
  const checkin = await page.goto('/checkin');
  expect(checkin?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible();

  const session = await page.goto('/session');
  expect(session?.ok()).toBe(true);
});
```

- [ ] **Step 2:** `pnpm gate` green; `pnpm e2e` passes locally (Chromium installed). **Step 3: Commit** `git commit -m "test(e2e): smoke check-in + session routes"`.

---

## Final verification

- [ ] `pnpm gate` green; `pnpm test` (sessionLog suite added); `pnpm e2e` green.
- [ ] Manual: Today → Check-in → flag wrist pain → Save → Today shows the adaptation banner ("wrist (TFCC) pain flagged…"). Today → Start session → adjust RPE → Finish → a SessionLog is saved (next-day ACWR reflects it).

## Self-Review

- **Spec coverage:** Check-in screen (spec screen 2) → Task 2; Session player with per-block targets + logging (screen 3) → Task 4; logging feeds load metrics (uses existing `saveLog`/`computeLoadMetrics`) → Tasks 1+4. ✅
- **Pure logic isolated + tested:** `createSessionLog`/`suggestSessionRPE` → Task 1 (≥90% branch). UI exercised by Playwright. ✅
- **Gate idioms:** `passing-the-gate.md` flagged in Tasks 2 & 4 (no `!` in src, `void` async handlers, typed events). ✅
- **Deferred to Plan 3:** Insights/ACWR gauge, history list, program calendar, drills library, rest timer, PWA offline service worker.
