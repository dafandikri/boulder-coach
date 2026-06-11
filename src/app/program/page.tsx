'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { programPosition } from '@/domain/programClock';
import { toOptionalLoadState, type OptionalLoadState } from '@/app/lib/loadState';
import type { Program, PhaseKind } from '@/domain/types';

const PHASE_COLORS: Record<PhaseKind, string> = {
  hard: 'bg-slate-900 text-white',
  peak: 'bg-amber-100 text-amber-900',
  deload: 'bg-green-100 text-green-800',
};

export default function ProgramPage() {
  const [load, setLoad] = useState<OptionalLoadState<Program>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void new DexieClimbRepo().getActiveProgram().then(
      (p) => {
        if (!cancelled) setLoad(toOptionalLoadState({ ok: true, data: p }));
      },
      (error: unknown) => {
        if (!cancelled) setLoad(toOptionalLoadState<Program>({ ok: false, error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (load.status === 'loading') return <main className="p-6">Loading…</main>;
  if (load.status === 'error') {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <Link href="/" className="text-sm text-gray-500">
          &larr; Today
        </Link>
        <h1 className="text-2xl font-bold">Couldn&apos;t load your program</h1>
        <p className="text-sm text-gray-600">{load.message}</p>
        <button
          type="button"
          onClick={() => {
            setReloadKey((k) => k + 1);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Retry
        </button>
      </main>
    );
  }
  if (load.status === 'empty') {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <Link href="/" className="text-sm text-gray-500">
          &larr; Today
        </Link>
        <h1 className="text-2xl font-bold">No active program</h1>
        <p className="text-sm text-gray-600">
          Set up your profile to generate a training cycle tailored to your grade and schedule.
        </p>
        <Link
          href="/profile"
          className="inline-block rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Create a program &rarr;
        </Link>
      </main>
    );
  }

  const program = load.data;
  const currentWeekIndex = programPosition(program, new Date()).weekIndex;

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Today
      </Link>
      <h1 className="text-2xl font-bold">Program</h1>
      <p className="text-sm text-gray-500">
        {program.lengthWeeks}-week cycle &middot; Started {program.startDate}
      </p>
      <div className="space-y-2">
        {program.weeks.map((w) => {
          const isCurrent = w.weekIndex === currentWeekIndex;
          return (
            <div
              key={w.weekIndex}
              className={`rounded-lg border p-3 ${isCurrent ? 'ring-2 ring-slate-500' : ''}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium">
                  Week {w.weekIndex + 1}
                  {isCurrent && <span className="ml-2 text-xs text-slate-500">(current)</span>}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLORS[w.phase]}`}
                >
                  {w.phase}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {w.sessions.map((s) => s.type.replace('-', ' ')).join(', ')}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
