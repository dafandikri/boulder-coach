'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';
import { localDateIso } from '@/app/lib/date';
import { toLoadState, type LoadState } from '@/app/lib/loadState';
import { canFinishSession, expandTally, warmupDone } from '@/app/lib/sessionForm';
import {
  formatRest,
  restConfigFor,
  restElapsed,
  restEndsAt,
  restRemainingSec,
  type RestConfig,
} from '@/app/lib/restTimer';
import { createSessionLog, type BlockActual } from '@/domain/sessionLog';
import type { VGrade } from '@/domain/types';

/** Audible + haptic "rest over" cue. Lives in the (gate-blind) component because
 *  it touches browser-only APIs; all the *decisions* about WHEN to fire are the
 *  tested pure helpers in restTimer.ts. Guarded so it no-ops where unsupported. */
function fireRestCue(): void {
  // Access browser-only APIs through optional-typed views: the DOM lib types them
  // as always-present, but they are genuinely absent under SSR / older browsers, so
  // the guards are real (not the "unnecessary conditions" the strict types assume).
  if (typeof navigator !== 'undefined') {
    const nav: { vibrate?: (pattern: number | number[]) => boolean } = navigator;
    nav.vibrate?.([200, 100, 200]);
  }
  if (typeof window === 'undefined') return;
  const w: { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext } =
    window;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const osc = ctx.createOscillator();
  osc.frequency.value = 880;
  osc.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

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
  const [load, setLoad] = useState<LoadState<TodayResult>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [entries, setEntries] = useState<Record<string, BlockEntry>>({});
  const [warmupChecked, setWarmupChecked] = useState<Set<string>>(new Set());
  const [durationMin, setDuration] = useState(60);

  // Rest timer: per block we store the wall-clock END timestamp (ms), or null when
  // idle. `now` re-derives the countdown from the clock each tick, so a screen-lock
  // (which suspends the interval) self-heals on wake instead of losing time.
  const [restEndsByBlock, setRestEndsByBlock] = useState<Record<string, number | null>>({});
  const [now, setNow] = useState(() => Date.now());
  const cuedRef = useRef<Set<string>>(new Set());

  const anyRestActive = Object.values(restEndsByBlock).some((e) => e !== null);
  useEffect(() => {
    if (!anyRestActive) return;
    const sync = (): void => {
      setNow(Date.now());
    };
    const id = setInterval(sync, 250);
    // Recompute immediately when the PWA returns to the foreground (post screen-lock).
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [anyRestActive]);

  useEffect(() => {
    for (const [blockId, endsAt] of Object.entries(restEndsByBlock)) {
      if (endsAt !== null && restElapsed(endsAt, now) && !cuedRef.current.has(blockId)) {
        cuedRef.current.add(blockId);
        fireRestCue();
      }
    }
  }, [now, restEndsByBlock]);

  const startRest = useCallback((blockId: string, seconds: number): void => {
    cuedRef.current.delete(blockId);
    setRestEndsByBlock((prev) => ({ ...prev, [blockId]: restEndsAt(Date.now(), seconds) }));
    setNow(Date.now());
  }, []);

  const stopRest = useCallback((blockId: string): void => {
    cuedRef.current.delete(blockId);
    setRestEndsByBlock((prev) => ({ ...prev, [blockId]: null }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getTodaySession(new DexieClimbRepo()).then(
      (t) => {
        if (cancelled) return;
        setLoad(toLoadState({ ok: true, data: t }));
        const seed: Record<string, BlockEntry> = {};
        for (const b of t.session.blocks) {
          seed[b.id] = { setsCompleted: b.sets, rpe: b.targetRPE, attempts: {}, sends: {} };
        }
        setEntries(seed);
      },
      (error: unknown) => {
        if (cancelled) return;
        setLoad(toLoadState<TodayResult>({ ok: false, error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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

  if (load.status === 'loading') return <main className="p-6">Loading…</main>;
  if (load.status === 'error') {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-bold">Couldn&apos;t load today&apos;s session</h1>
        <p className="text-sm text-gray-600">{load.message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setReloadKey((k) => k + 1);
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => {
              router.push('/');
            }}
            className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
          >
            Back to Today
          </button>
        </div>
      </main>
    );
  }
  const today = load.data;
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

              <RestControl
                endsAt={restEndsByBlock[b.id] ?? null}
                now={now}
                config={restConfigFor(session.type)}
                onStart={(seconds) => {
                  startRest(b.id, seconds);
                }}
                onStop={() => {
                  stopRest(b.id);
                }}
              />
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

/** Per-block rest timer. Idle: one (or two, for 4×4) "start rest" buttons sized
 *  to the session-type defaults. Running: a live M:SS countdown + Stop. All timing
 *  maths is delegated to restTimer.ts; this is pure wiring. */
function RestControl({
  endsAt,
  now,
  config,
  onStart,
  onStop,
}: {
  endsAt: number | null;
  now: number;
  config: RestConfig;
  onStart: (seconds: number) => void;
  onStop: () => void;
}) {
  if (endsAt !== null) {
    const remaining = restRemainingSec(endsAt, now);
    const done = remaining === 0;
    return (
      <div className="mt-3 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
        <span
          className={`font-mono text-lg tabular-nums ${done ? 'text-emerald-600' : 'text-slate-900'}`}
          aria-live="polite"
        >
          {done ? 'Rest done — go!' : `Rest ${formatRest(remaining)}`}
        </span>
        <button
          type="button"
          onClick={onStop}
          className="rounded bg-gray-200 px-3 py-1 text-sm font-medium hover:bg-gray-300"
        >
          {done ? 'Dismiss' : 'Stop'}
        </button>
      </div>
    );
  }
  const rounds = config.betweenRounds;
  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        onClick={() => {
          onStart(config.betweenSets);
        }}
        className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200"
      >
        Rest {formatRest(config.betweenSets)}
      </button>
      {rounds !== undefined && (
        <button
          type="button"
          onClick={() => {
            onStart(rounds);
          }}
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200"
        >
          Round {formatRest(rounds)}
        </button>
      )}
    </div>
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
