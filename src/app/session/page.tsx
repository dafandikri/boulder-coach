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
  const session = today.session;

  function setRpe(blockId: string, rpe: number): void {
    setActuals((a) => {
      const cur = a[blockId];
      if (!cur) return a;
      return { ...a, [blockId]: { ...cur, rpe } };
    });
  }

  async function finish(): Promise<void> {
    const log = createSessionLog({
      date: todayIso(),
      plannedSessionId: session.id,
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
        {session.blocks.map((b) => {
          const rpe = actuals[b.id]?.rpe ?? b.targetRPE;
          return (
            <li key={b.id} className="rounded-lg border p-4">
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-gray-600">
                target: {b.sets} × {b.grip} · RPE {b.targetRPE}
              </p>
              <label className="mt-2 block text-sm">
                Your RPE: {rpe}
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={rpe}
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
        onClick={() => void finish()}
        className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white"
      >
        Finish &amp; log session
      </button>
    </main>
  );
}
