'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DexieClimbRepo } from '@/data/dexieRepo';
import type { SessionLog } from '@/domain/types';

export default function HistoryPage() {
  const [logs, setLogs] = useState<SessionLog[]>([]);

  useEffect(() => {
    void new DexieClimbRepo().getLogs().then(setLogs);
  }, []);

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Today
      </Link>
      <h1 className="text-2xl font-bold">History</h1>
      {logs.length === 0 && <p className="text-gray-500">No sessions logged yet.</p>}
      <ul className="space-y-2">
        {logs.toReversed().map((l) => (
          <li key={l.id} className="rounded-lg border p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{l.date}</span>
              <span className="text-xs text-gray-400">
                RPE {l.sessionRPE} &middot; {l.durationMin}min
              </span>
            </div>
            {l.notes && <p className="mt-1 text-sm text-gray-600">{l.notes}</p>}
            <p className="mt-1 text-xs text-gray-400">
              {l.blocks.length} blocks &middot; {l.warmupCompleted ? 'warm-up done' : 'no warm-up'}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
