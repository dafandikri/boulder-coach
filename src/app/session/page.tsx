'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';
import { localDateIso } from '@/app/lib/date';
import { canFinishSession, expandTally, warmupDone } from '@/app/lib/sessionForm';
import { createSessionLog, type BlockActual } from '@/domain/sessionLog';
import type { VGrade } from '@/domain/types';

type Tally = Partial<Record<VGrade, number>>;

/** Per-block UI state. Grades are tallied as {grade: count}; expanded to the
 *  flat VGrade[] the log stores only at save time (see expandTally). */
interface BlockEntry {
  setsCompleted: number;
  rpe: number;
  attempts: Tally;
  sends: Tally;
}

/** A compact, thumb-sized grade range centred on the block's target. */
function gradeChoices(targetGrade: VGrade | undefined): VGrade[] {
  const lo = Math.max(1, (targetGrade ?? 4) - 2);
  return [lo, lo + 1, lo + 2, lo + 3];
}

export default function SessionPage() {
  const router = useRouter();
  const [today, setToday] = useState<TodayResult | null>(null);
  const [entries, setEntries] = useState<Record<string, BlockEntry>>({});
  const [warmupChecked, setWarmupChecked] = useState<Set<string>>(new Set());
  const [durationMin, setDuration] = useState(60);

  useEffect(() => {
    void getTodaySession(new DexieClimbRepo()).then((t) => {
      setToday(t);
      const seed: Record<string, BlockEntry> = {};
      for (const b of t.session.blocks) {
        seed[b.id] = { setsCompleted: b.sets, rpe: b.targetRPE, attempts: {}, sends: {} };
      }
      setEntries(seed);
    });
  }, []);

  const setRpe = useCallback((blockId: string, rpe: number): void => {
    setEntries((prev) => {
      const cur = prev[blockId];
      if (!cur) return prev;
      return { ...prev, [blockId]: { ...cur, rpe } };
    });
  }, []);

  const setSets = useCallback((blockId: string, sets: number): void => {
    setEntries((prev) => {
      const cur = prev[blockId];
      if (!cur) return prev;
      return { ...prev, [blockId]: { ...cur, setsCompleted: sets } };
    });
  }, []);

  const adjustTally = useCallback(
    (blockId: string, kind: 'attempts' | 'sends', grade: VGrade, delta: number): void => {
      setEntries((prev) => {
        const cur = prev[blockId];
        if (!cur) return prev;
        const next = Math.max(0, (cur[kind][grade] ?? 0) + delta);
        return { ...prev, [blockId]: { ...cur, [kind]: { ...cur[kind], [grade]: next } } };
      });
    },
    [],
  );

  const toggleWarmup = useCallback((id: string): void => {
    setWarmupChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!today) return <main className="p-6">Loading…</main>;
  const session = today.session;
  const warmupBlockIds = session.blocks.filter((b) => b.category === 'warmup').map((b) => b.id);
  const finishBlocked = !canFinishSession(today.warmupMandatory, warmupBlockIds, warmupChecked);

  async function finish(): Promise<void> {
    const blocks: BlockActual[] = session.blocks.map((b) => {
      const e = entries[b.id];
      return {
        blockId: b.id,
        setsCompleted: e?.setsCompleted ?? b.sets,
        gradesAttempted: expandTally(e?.attempts ?? {}),
        gradesSent: expandTally(e?.sends ?? {}),
        rpe: e?.rpe ?? b.targetRPE,
      };
    });
    const log = createSessionLog({
      date: localDateIso(new Date()),
      plannedSessionId: session.id,
      warmupCompleted: warmupDone(warmupBlockIds, warmupChecked),
      blocks,
      durationMin,
    });
    await new DexieClimbRepo().saveLog(log);
    router.push('/');
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-bold">Session</h1>
      <ol className="space-y-3">
        {session.blocks.map((b) => {
          const entry = entries[b.id];
          if (!entry) return null;
          const isWarmup = b.category === 'warmup';
          const showGrades = b.category === 'main' && b.targetGrade !== undefined;
          return (
            <li key={b.id} className="rounded-lg border p-4">
              <p className="font-medium">
                {isWarmup && (
                  <input
                    type="checkbox"
                    checked={warmupChecked.has(b.id)}
                    onChange={() => {
                      toggleWarmup(b.id);
                    }}
                    className="mr-2 align-middle"
                  />
                )}
                {b.name}
              </p>
              <p className="text-sm text-gray-600">
                target: {b.sets} × {b.grip}
                {b.targetGrade !== undefined ? ` · V${b.targetGrade}` : ''} · RPE {b.targetRPE}
              </p>

              <label className="mt-2 block text-sm">
                Sets completed:
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={entry.setsCompleted}
                  onChange={(e) => {
                    setSets(b.id, Math.max(0, Number(e.target.value)));
                  }}
                  className="ml-2 w-16 rounded border px-2 py-0.5 text-sm"
                />
              </label>

              {showGrades && (
                <div className="mt-3 space-y-1">
                  <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 text-xs text-gray-400">
                    <span></span>
                    <span className="text-center">attempts</span>
                    <span className="text-center">sends</span>
                  </div>
                  {gradeChoices(b.targetGrade).map((g) => (
                    <div
                      key={g}
                      className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2 text-sm"
                    >
                      <span className="font-medium">V{g}</span>
                      <Stepper
                        value={entry.attempts[g] ?? 0}
                        onAdd={() => {
                          adjustTally(b.id, 'attempts', g, 1);
                        }}
                        onSub={() => {
                          adjustTally(b.id, 'attempts', g, -1);
                        }}
                      />
                      <Stepper
                        value={entry.sends[g] ?? 0}
                        onAdd={() => {
                          adjustTally(b.id, 'sends', g, 1);
                        }}
                        onSub={() => {
                          adjustTally(b.id, 'sends', g, -1);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <label className="mt-3 block text-sm">
                Your RPE: {entry.rpe}
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={entry.rpe}
                  onChange={(e) => {
                    setRpe(b.id, Number(e.target.value));
                  }}
                  className="w-full"
                />
              </label>
            </li>
          );
        })}
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
        onClick={() => {
          void finish();
        }}
        disabled={finishBlocked}
        className={`w-full rounded-lg py-3 font-medium text-white ${
          finishBlocked ? 'cursor-not-allowed bg-gray-400' : 'bg-slate-900 hover:bg-slate-800'
        }`}
      >
        {finishBlocked ? 'Complete warm-up first' : 'Finish & log session'}
      </button>
    </main>
  );
}

/** Thumb-sized −/count/+ control for a single grade tally. */
function Stepper({ value, onAdd, onSub }: { value: number; onAdd: () => void; onSub: () => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={onSub}
        aria-label="decrease"
        className="h-7 w-7 rounded bg-gray-100 text-base leading-none hover:bg-gray-200"
      >
        −
      </button>
      <span className="w-4 text-center font-medium tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onAdd}
        aria-label="increase"
        className="h-7 w-7 rounded bg-gray-100 text-base leading-none hover:bg-gray-200"
      >
        +
      </button>
    </div>
  );
}
