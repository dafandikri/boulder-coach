'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { programPosition } from '@/domain/programClock';
import { toOptionalLoadState, type OptionalLoadState } from '@/app/lib/loadState';
import type { Program, PhaseKind } from '@/domain/types';
import { Card } from '@/app/components/Card';
import { Badge } from '@/app/components/Badge';
import { Button } from '@/app/components/Button';
import { Callout } from '@/app/components/Callout';
import { HoldMark } from '@/app/components/HoldMark';
import { BackLink } from '@/app/components/BackLink';
import { Spinner } from '@/app/components/Spinner';

/** Phase → Badge tone (presentational): hard pushes, peak warns, deload recovers. */
const PHASE_TONE: Record<PhaseKind, 'brand' | 'warning' | 'success'> = {
  hard: 'brand',
  peak: 'warning',
  deload: 'success',
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

  if (load.status === 'loading') return <Spinner label="Loading your program…" />;

  if (load.status === 'error') {
    return (
      <main className="space-y-4 p-5">
        <BackLink href="/" label="Today" />
        <Callout tone="danger" title="Couldn't load your program">
          {load.message}
        </Callout>
        <Button
          variant="secondary"
          icon="arrow-right"
          onClick={() => {
            setReloadKey((k) => k + 1);
          }}
        >
          Retry
        </Button>
      </main>
    );
  }

  if (load.status === 'empty') {
    return (
      <main className="space-y-4 p-5">
        <BackLink href="/" label="Today" />
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <HoldMark color="grape" size={72} rotate={-6} />
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>No active program</h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', maxWidth: '22rem' }}>
            Set up your profile to generate a training cycle tailored to your grade and schedule.
          </p>
          <Link href="/profile" className="bc-btn">
            Create a program →
          </Link>
        </div>
      </main>
    );
  }

  const program = load.data;
  const currentWeekIndex = programPosition(program, new Date()).weekIndex;

  return (
    <main className="space-y-4 p-5">
      <BackLink href="/" label="Today" />
      <header className="pt-1">
        <div className="bc-eyebrow">
          {program.lengthWeeks}-week cycle · Started {program.startDate}
        </div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Program</h1>
      </header>

      <div className="space-y-2.5">
        {program.weeks.map((w) => {
          const isCurrent = w.weekIndex === currentWeekIndex;
          return (
            <Card
              key={w.weekIndex}
              feature={isCurrent}
              accent={isCurrent ? 'var(--brand)' : undefined}
              padding="sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-base)' }}>
                  Week {w.weekIndex + 1}
                  {isCurrent && (
                    <span
                      className="bc-eyebrow"
                      style={{ marginLeft: 8, color: 'var(--brand-deep)' }}
                    >
                      Now
                    </span>
                  )}
                </span>
                <Badge tone={PHASE_TONE[w.phase]} solid={isCurrent}>
                  {w.phase}
                </Badge>
              </div>
              <p
                style={{
                  marginTop: 4,
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {w.sessions.map((s) => s.type.replace('-', ' ')).join(' · ')}
              </p>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
