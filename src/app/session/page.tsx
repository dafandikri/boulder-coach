'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { getRepo } from '@/data/repoInstance';
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
import { VB } from '@/domain/grade';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';
import { Callout } from '@/app/components/Callout';
import { GradePill } from '@/app/components/GradePill';
import { BackLink } from '@/app/components/BackLink';
import { Spinner } from '@/app/components/Spinner';
import { ExerciseDetail } from '@/app/components/ExerciseDetail';
import { BlockSummary } from '@/app/components/BlockSummary';
import { hasRichContent } from '@/domain/exerciseContent';

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
  const lo = Math.max(VB, (targetGrade ?? 4) - 2);
  return [lo, lo + 1, lo + 2, lo + 3];
}

const CAT_TONE: Record<string, 'info' | 'brand' | 'grape' | 'success' | 'neutral'> = {
  warmup: 'info',
  main: 'brand',
  prehab: 'grape',
  technique: 'success',
  cooldown: 'neutral',
};

export default function SessionPage() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState<TodayResult>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [entries, setEntries] = useState<Record<string, BlockEntry>>({});
  const [warmupChecked, setWarmupChecked] = useState<Set<string>>(new Set());
  const [openHowTo, setOpenHowTo] = useState<Set<string>>(new Set());
  const [durationMin, setDuration] = useState(60);

  const toggleHowTo = useCallback((id: string): void => {
    setOpenHowTo((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    void getTodaySession(getRepo()).then(
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

  if (load.status === 'loading') return <Spinner label="Loading today's session…" />;
  if (load.status === 'error') {
    return (
      <main className="space-y-4 p-5">
        <BackLink href="/" label="Today" />
        <Callout tone="danger" title="Couldn't load today's session">
          {load.message}
        </Callout>
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setReloadKey((k) => k + 1);
            }}
          >
            Retry
          </Button>
          <Button
            fullWidth
            onClick={() => {
              router.push('/');
            }}
          >
            Back to Today
          </Button>
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
    await getRepo().saveLog(log);
    router.push('/');
  }

  return (
    <main className="space-y-4 p-5">
      <BackLink href="/" label="Today" />
      <header className="pt-1">
        <div className="bc-eyebrow">Log as you go</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Session</h1>
      </header>

      {today.warmupMandatory && (
        <Callout tone="warning" title="Warm-up is mandatory today.">
          Tick every warm-up block before you can finish &amp; log.
        </Callout>
      )}

      <ol className="space-y-3">
        {session.blocks.map((b) => {
          const entry = entries[b.id];
          if (!entry) return null;
          const isWarmup = b.category === 'warmup';
          const showGrades = b.category === 'main' && b.targetGrade !== undefined;
          const checked = warmupChecked.has(b.id);
          return (
            <li key={b.id}>
              <Card feature={isWarmup && checked}>
                <BlockSummary
                  block={b}
                  badgeTone={CAT_TONE[b.category] ?? 'neutral'}
                  leading={
                    isWarmup ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          toggleWarmup(b.id);
                        }}
                        style={{ marginTop: 3, width: 18, height: 18, accentColor: 'var(--brand)' }}
                      />
                    ) : undefined
                  }
                />

                {b.content && hasRichContent(b.content) && (
                  <div style={{ marginTop: 10 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={openHowTo.has(b.id) ? 'x' : 'info'}
                      onClick={() => {
                        toggleHowTo(b.id);
                      }}
                    >
                      {openHowTo.has(b.id) ? 'Hide how-to' : 'How to do this'}
                    </Button>
                    {openHowTo.has(b.id) && (
                      <div style={{ marginTop: 12 }}>
                        <ExerciseDetail content={b.content} />
                      </div>
                    )}
                  </div>
                )}

                <label
                  className="flex items-center gap-2"
                  style={{ marginTop: 12, fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                >
                  Sets completed
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={entry.setsCompleted}
                    onChange={(e) => {
                      setSets(b.id, Math.max(0, Number(e.target.value)));
                    }}
                    style={{
                      width: 64,
                      borderRadius: 'var(--r-sm)',
                      border: '2px solid var(--border)',
                      background: 'var(--surface)',
                      padding: '4px 8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-sm)',
                    }}
                  />
                </label>

                {showGrades && (
                  <div className="space-y-1.5" style={{ marginTop: 12 }}>
                    <div
                      className="grid items-center gap-2 bc-eyebrow"
                      style={{ gridTemplateColumns: '3rem 1fr 1fr' }}
                    >
                      <span></span>
                      <span style={{ textAlign: 'center' }}>attempts</span>
                      <span style={{ textAlign: 'center' }}>sends</span>
                    </div>
                    {gradeChoices(b.targetGrade).map((g) => (
                      <div
                        key={g}
                        className="grid items-center gap-2"
                        style={{ gridTemplateColumns: '3rem 1fr 1fr' }}
                      >
                        <GradePill grade={g} size="sm" />
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

                <label className="block" style={{ marginTop: 12 }}>
                  <span
                    className="flex items-baseline justify-between"
                    style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                  >
                    Your RPE
                    <span className="bc-mono" style={{ color: 'var(--brand-deep)' }}>
                      {entry.rpe}/10
                    </span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={entry.rpe}
                    onChange={(e) => {
                      setRpe(b.id, Number(e.target.value));
                    }}
                    className="w-full"
                    style={{ marginTop: 6 }}
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
              </Card>
            </li>
          );
        })}
      </ol>

      <Card padding="sm">
        <label className="block">
          <span
            className="flex items-baseline justify-between"
            style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}
          >
            Duration
            <span className="bc-mono" style={{ color: 'var(--brand-deep)' }}>
              {durationMin} min
            </span>
          </span>
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
            style={{ marginTop: 6 }}
          />
        </label>
      </Card>

      <Button
        variant="success"
        size="lg"
        icon={finishBlocked ? 'shield' : 'trophy'}
        fullWidth
        disabled={finishBlocked}
        onClick={() => {
          void finish();
        }}
      >
        {finishBlocked ? 'Complete warm-up first' : 'Finish & log session'}
      </Button>
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
      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 12,
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          background: done ? 'var(--success-tint)' : 'var(--bg-sunk)',
          border: `2px solid ${done ? 'var(--success)' : 'var(--border)'}`,
        }}
      >
        <span
          className="bc-mono"
          style={{
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            color: done ? 'var(--success-deep)' : 'var(--text)',
          }}
          aria-live="polite"
        >
          {done ? 'Rest done — go!' : `Rest ${formatRest(remaining)}`}
        </span>
        <Button variant="secondary" size="sm" onClick={onStop}>
          {done ? 'Dismiss' : 'Stop'}
        </Button>
      </div>
    );
  }
  const rounds = config.betweenRounds;
  return (
    <div className="flex gap-2" style={{ marginTop: 12 }}>
      <Button
        variant="secondary"
        size="sm"
        icon="timer"
        onClick={() => {
          onStart(config.betweenSets);
        }}
      >
        Rest {formatRest(config.betweenSets)}
      </Button>
      {rounds !== undefined && (
        <Button
          variant="secondary"
          size="sm"
          icon="timer"
          onClick={() => {
            onStart(rounds);
          }}
        >
          Round {formatRest(rounds)}
        </Button>
      )}
    </div>
  );
}

/** Thumb-sized −/count/+ control for a single grade tally. */
function Stepper({ value, onAdd, onSub }: { value: number; onAdd: () => void; onSub: () => void }) {
  const btn: CSSProperties = {
    height: 32,
    width: 32,
    flex: 'none',
    borderRadius: 'var(--r-sm)',
    border: '2px solid var(--border)',
    background: 'var(--surface)',
    fontSize: 'var(--fs-md)',
    fontWeight: 800,
    lineHeight: 1,
    cursor: 'pointer',
  };
  return (
    <div className="flex items-center justify-center gap-2">
      <button type="button" onClick={onSub} aria-label="decrease" style={btn}>
        −
      </button>
      <span className="bc-mono" style={{ width: 18, textAlign: 'center', fontWeight: 700 }}>
        {value}
      </span>
      <button type="button" onClick={onAdd} aria-label="increase" style={btn}>
        +
      </button>
    </div>
  );
}
