'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';
import { programPosition } from '@/domain/programClock';
import { prescribeOffWall, type OffWallPrescription } from '@/domain/offWallExercises';
import { toLoadState, type LoadState } from '@/app/lib/loadState';

// BC-22: off-wall work is ADDITIVE ONLY — supplementary balance/mobility, never
// a climbing-load increase. This page ONLY renders; the prescription (which
// purposes, which exercises) is decided by the pure, tested domain module
// `prescribeOffWall`. No selection logic lives here.

export default function ExercisesPage() {
  const [load, setLoad] = useState<LoadState<OffWallPrescription>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const repo = new DexieClimbRepo();
    const asOf = new Date();
    void Promise.all([getTodaySession(repo, asOf), repo.getActiveProgram()]).then(
      ([today, program]: [TodayResult, Awaited<ReturnType<typeof repo.getActiveProgram>>]) => {
        if (cancelled) return;
        // A deload week emphasises recovery — pass its phase so the picker can
        // override to mobility-only. Absent a program, undefined phase is fine.
        const phase = program?.weeks[programPosition(program, asOf).weekIndex]?.phase;
        const rx = prescribeOffWall(today.session.type, phase);
        setLoad(toLoadState({ ok: true, data: rx }));
      },
      (error: unknown) => {
        if (!cancelled) setLoad(toLoadState<OffWallPrescription>({ ok: false, error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.status === 'loading') return <main className="p-6">Loading…</main>;
  if (load.status === 'error') {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <Link href="/" className="text-sm text-gray-500">
          &larr; Today
        </Link>
        <h1 className="text-2xl font-bold">Couldn&apos;t load off-wall work</h1>
        <p className="text-sm text-gray-600">{load.message}</p>
      </main>
    );
  }

  const { purposes, exercises } = load.data;

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Today
      </Link>
      <h1 className="text-2xl font-bold">Off-the-wall</h1>
      <p className="text-sm text-gray-500">
        Supplementary {purposes.join(' + ')} work to balance today&apos;s climbing — additive only,
        it never adds climbing load.
      </p>

      <div className="space-y-3">
        {exercises.map((ex) => (
          <article key={ex.id} className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{ex.name}</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {ex.purpose}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{ex.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
