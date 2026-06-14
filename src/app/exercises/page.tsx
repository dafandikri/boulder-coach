'use client';

import { useEffect, useState } from 'react';
import { getRepo } from '@/data/repoInstance';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';
import { programPosition } from '@/domain/programClock';
import { prescribeOffWall, type OffWallPrescription } from '@/domain/offWallExercises';
import { toLoadState, type LoadState } from '@/app/lib/loadState';
import { Card } from '@/app/components/Card';
import { Badge } from '@/app/components/Badge';
import { Button } from '@/app/components/Button';
import { Callout } from '@/app/components/Callout';
import { BackLink } from '@/app/components/BackLink';
import { Spinner } from '@/app/components/Spinner';
import { ExerciseDetail } from '@/app/components/ExerciseDetail';

// BC-22: off-wall work is ADDITIVE ONLY — supplementary balance/mobility, never
// a climbing-load increase. This page ONLY renders; the prescription (which
// purposes, which exercises) is decided by the pure, tested domain module
// `prescribeOffWall`. No selection logic lives here.

export default function ExercisesPage() {
  const [load, setLoad] = useState<LoadState<OffWallPrescription>>({ status: 'loading' });
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const repo = getRepo();
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

  if (load.status === 'loading') return <Spinner label="Loading off-wall work…" />;
  if (load.status === 'error') {
    return (
      <main className="space-y-4 p-5">
        <BackLink href="/" label="Today" />
        <Callout tone="danger" title="Couldn't load off-wall work">
          {load.message}
        </Callout>
      </main>
    );
  }

  const { purposes, exercises } = load.data;
  const open = exercises.find((e) => e.id === openId);

  // Detail view — dosage + step-by-step + image (BC-46/BC-50).
  if (open) {
    return (
      <main className="space-y-4 p-5">
        <button
          type="button"
          onClick={() => {
            setOpenId(null);
          }}
          className="bc-eyebrow"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-deep)' }}
        >
          ← All off-wall work
        </button>
        <div className="flex items-center gap-2">
          <Badge tone="grape">{open.purpose}</Badge>
        </div>
        <Card>
          <ExerciseDetail title={open.name} content={open} />
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-5">
      <BackLink href="/" label="Today" />
      <header className="pt-1">
        <div className="bc-eyebrow">Additive only</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Off-the-wall</h1>
      </header>

      <Callout tone="success" icon="shield">
        Supplementary {purposes.join(' + ')} work to balance today&apos;s climbing — it never adds
        climbing load.
      </Callout>

      <div className="space-y-3">
        {exercises.map((ex) => (
          <Card key={ex.id}>
            <div className="flex items-center justify-between gap-2">
              <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>{ex.name}</h2>
              <Badge tone="grape">{ex.purpose}</Badge>
            </div>
            <p style={{ marginTop: 4, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              {ex.description}
            </p>
            {ex.dosage ? (
              <p
                style={{
                  marginTop: 6,
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-soft)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {ex.dosage}
              </p>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <Button
                variant="secondary"
                size="sm"
                icon="arrow-right"
                onClick={() => {
                  setOpenId(ex.id);
                }}
              >
                Instructions
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
