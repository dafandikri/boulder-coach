'use client';

import { useEffect, useState } from 'react';
import { DexieClimbRepo } from '@/data/dexieRepo';
import type { SessionLog } from '@/domain/types';
import { Card } from '@/app/components/Card';
import { Badge } from '@/app/components/Badge';
import { HoldMark } from '@/app/components/HoldMark';
import { BackLink } from '@/app/components/BackLink';

export default function HistoryPage() {
  const [logs, setLogs] = useState<SessionLog[]>([]);

  useEffect(() => {
    void new DexieClimbRepo().getLogs().then(setLogs);
  }, []);

  return (
    <main className="space-y-4 p-5">
      <BackLink href="/" label="Today" />
      <header className="pt-1">
        <div className="bc-eyebrow">Your logbook</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>History</h1>
      </header>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <HoldMark color="sky" size={64} rotate={-6} />
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            No sessions logged yet — finish a session and it lands here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {logs.toReversed().map((l) => (
            <li key={l.id}>
              <Card padding="sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="bc-mono" style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
                    {l.date}
                  </span>
                  <Badge tone="brand">RPE {l.sessionRPE}</Badge>
                </div>
                {l.notes && (
                  <p style={{ marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    {l.notes}
                  </p>
                )}
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-soft)',
                    fontWeight: 600,
                  }}
                >
                  {l.blocks.length} blocks · {l.durationMin} min ·{' '}
                  {l.warmupCompleted ? 'warm-up done' : 'no warm-up'}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
