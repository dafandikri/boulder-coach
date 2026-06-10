'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';
import { localDateIso } from '@/app/lib/date';
import { canFinishSession, warmupDone } from '@/app/lib/sessionForm';
import { createSessionLog, type BlockActual } from '@/domain/sessionLog';

export default function SessionPage() {
  const router = useRouter();
  const [today, setToday] = useState<TodayResult | null>(null);
  const [actuals, setActuals] = useState<Record<string, BlockActual>>({});
  const [warmupChecked, setWarmupChecked] = useState<Set<string>>(new Set());
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

  const setRpe = useCallback((blockId: string, rpe: number): void => {
    setActuals((a) => {
      const cur = a[blockId];
      if (!cur) return a;
      return { ...a, [blockId]: { ...cur, rpe } };
    });
  }, []);

  const setSets = useCallback((blockId: string, sets: number): void => {
    setActuals((a) => {
      const cur = a[blockId];
      if (!cur) return a;
      return { ...a, [blockId]: { ...cur, setsCompleted: sets } };
    });
  }, []);

  function bumpGrade(
    blockId: string,
    field: 'gradesAttempted' | 'gradesSent',
    delta: number,
  ): void {
    setActuals((a) => {
      const cur = a[blockId];
      if (!cur) return a;
      const grades = field === 'gradesAttempted' ? cur.gradesAttempted : cur.gradesSent;
      const last = grades[grades.length - 1] ?? 4;
      const next = Math.max(1, last + delta);
      const updated = [...grades, next];
      return {
        ...a,
        [blockId]: {
          ...cur,
          [field]: field === 'gradesAttempted' ? updated : cur.gradesAttempted,
          ...(field === 'gradesSent' ? { gradesSent: updated } : {}),
        },
      };
    });
  }

  if (!today) return <main className="p-6">Loading…</main>;
  const session = today.session;
  const warmupBlockIds = session.blocks.filter((b) => b.category === 'warmup').map((b) => b.id);
  const finishBlocked = !canFinishSession(today.warmupMandatory, warmupBlockIds, warmupChecked);

  function toggleWarmup(id: string): void {
    setWarmupChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function finish(): Promise<void> {
    const log = createSessionLog({
      date: localDateIso(new Date()),
      plannedSessionId: session.id,
      warmupCompleted: warmupDone(warmupBlockIds, warmupChecked),
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
        {session.blocks.map((b) => {
          const actual = actuals[b.id];
          if (!actual) return null;
          const isWarmup = b.category === 'warmup';
          const checked = warmupChecked.has(b.id);
          return (
            <li key={b.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">
                    {isWarmup && (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          toggleWarmup(b.id);
                        }}
                        className="mr-2"
                      />
                    )}
                    {b.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    target: {b.sets} × {b.grip} · RPE {b.targetRPE}
                  </p>
                </div>
              </div>

              <label className="mt-2 block text-sm">
                Sets completed:
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={actual.setsCompleted}
                  onChange={(e) => {
                    setSets(b.id, Math.max(0, Number(e.target.value)));
                  }}
                  className="ml-2 w-16 rounded border px-2 py-0.5 text-sm"
                />
              </label>

              {!isWarmup && (
                <div className="mt-2 flex gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Attempted: </span>
                    <button
                      onClick={() => {
                        bumpGrade(b.id, 'gradesAttempted', -1);
                      }}
                      className="rounded bg-gray-100 px-1.5 hover:bg-gray-200"
                    >
                      −
                    </button>{' '}
                    <span className="font-medium">
                      {actual.gradesAttempted.length > 0 ? actual.gradesAttempted.join(', ') : '—'}
                    </span>{' '}
                    <button
                      onClick={() => {
                        bumpGrade(b.id, 'gradesAttempted', 1);
                      }}
                      className="rounded bg-gray-100 px-1.5 hover:bg-gray-200"
                    >
                      +
                    </button>
                  </div>
                  <div>
                    <span className="text-gray-500">Sent: </span>
                    <button
                      onClick={() => {
                        bumpGrade(b.id, 'gradesSent', -1);
                      }}
                      className="rounded bg-gray-100 px-1.5 hover:bg-gray-200"
                    >
                      −
                    </button>{' '}
                    <span className="font-medium">
                      {actual.gradesSent.length > 0 ? actual.gradesSent.join(', ') : '—'}
                    </span>{' '}
                    <button
                      onClick={() => {
                        bumpGrade(b.id, 'gradesSent', 1);
                      }}
                      className="rounded bg-gray-100 px-1.5 hover:bg-gray-200"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <label className="mt-2 block text-sm">
                Your RPE: {actual.rpe}
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={actual.rpe}
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
