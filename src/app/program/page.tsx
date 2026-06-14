'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRepo } from '@/data/repoInstance';
import { programPosition } from '@/domain/programClock';
import { weekSummary } from '@/domain/periodization';
import { toOptionalLoadState, type OptionalLoadState } from '@/app/lib/loadState';
import type { Program, PhaseKind, PlannedSession } from '@/domain/types';
import { hasRichContent } from '@/domain/exerciseContent';
import { Card } from '@/app/components/Card';
import { Badge } from '@/app/components/Badge';
import { Button } from '@/app/components/Button';
import { Callout } from '@/app/components/Callout';
import { HoldMark } from '@/app/components/HoldMark';
import { BackLink } from '@/app/components/BackLink';
import { Spinner } from '@/app/components/Spinner';
import { ExerciseDetail } from '@/app/components/ExerciseDetail';
import { BlockSummary } from '@/app/components/BlockSummary';

/** Phase → Badge tone (presentational): hard pushes, peak warns, deload recovers. */
const PHASE_TONE: Record<PhaseKind, 'brand' | 'warning' | 'success'> = {
  hard: 'brand',
  peak: 'warning',
  deload: 'success',
};

export default function ProgramPage() {
  const [load, setLoad] = useState<OptionalLoadState<Program>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getRepo()
      .getActiveProgram()
      .then(
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

  // BC-48: session drill-down — tap a week's session to see its real blocks.
  const openSession = openSessionId
    ? program.weeks.flatMap((w) => w.sessions).find((s) => s.id === openSessionId)
    : undefined;

  if (openSession) {
    return (
      <main className="space-y-4 p-5">
        <button
          type="button"
          onClick={() => {
            setOpenSessionId(null);
          }}
          className="bc-eyebrow"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-deep)' }}
        >
          ← Week {openSession.weekIndex + 1}
        </button>
        <header className="pt-1">
          <div className="bc-eyebrow">Week {openSession.weekIndex + 1} session</div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>{openSession.type.replace('-', ' ')}</h1>
        </header>
        <SessionBlocks session={openSession} />
      </main>
    );
  }

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
          const expanded = openWeek === w.weekIndex;
          const summary = weekSummary(w);
          return (
            <Card
              key={w.weekIndex}
              feature={isCurrent}
              accent={isCurrent ? 'var(--brand)' : undefined}
              padding="sm"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenWeek(expanded ? null : w.weekIndex);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
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
                  {/* BC-53: the week's short label (Build 1 / Deload / Peak) — phase
                      tone, but differentiating across same-phase weeks. */}
                  <Badge tone={PHASE_TONE[w.phase]} solid={isCurrent}>
                    {summary.title}
                  </Badge>
                </div>
                {/* BC-53: an honest plain-language plan — what to do this week and why
                    (no misleading "focus: <drill>"). The session rotation is still
                    reachable by expanding the week below. */}
                <p
                  style={{
                    marginTop: 4,
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    lineHeight: 1.45,
                  }}
                >
                  {summary.detail}
                </p>
              </button>

              {expanded && (
                <div className="space-y-2" style={{ marginTop: 10 }}>
                  {w.sessions.map((s) => (
                    <Button
                      key={s.id}
                      variant="secondary"
                      size="sm"
                      icon="arrow-right"
                      fullWidth
                      onClick={() => {
                        setOpenSessionId(s.id);
                      }}
                    >
                      {s.type.replace('-', ' ')}
                    </Button>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}

/** Renders a planned session's blocks with targets + the one-line summary + how-to
 *  (BC-54 shares BlockSummary across all three surfaces; BC-48 reuses BC-46's
 *  ExerciseDetail). Read-only — this is the program preview, not the logger. */
function SessionBlocks({ session }: { session: PlannedSession }) {
  return (
    <ol className="space-y-3">
      {session.blocks.map((b) => (
        <li key={b.id}>
          <Card>
            <BlockSummary block={b}>
              {b.content && hasRichContent(b.content) && (
                <div style={{ marginTop: 10 }}>
                  <ExerciseDetail content={b.content} />
                </div>
              )}
            </BlockSummary>
          </Card>
        </li>
      ))}
    </ol>
  );
}
