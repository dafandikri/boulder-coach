'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { programPosition } from '@/domain/programClock';
import type { Program, PhaseKind } from '@/domain/types';

const PHASE_COLORS: Record<PhaseKind, string> = {
  hard: 'bg-slate-900 text-white',
  peak: 'bg-amber-100 text-amber-900',
  deload: 'bg-green-100 text-green-800',
};

export default function ProgramPage() {
  const [program, setProgram] = useState<Program | null>(null);

  useEffect(() => {
    void new DexieClimbRepo().getActiveProgram().then((p) => {
      setProgram(p ?? null);
    });
  }, []);

  if (!program) return <main className="p-6">No active program.</main>;

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
