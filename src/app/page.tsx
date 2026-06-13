'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';
import { Button } from '@/app/components/Button';
import { BlockSummary } from '@/app/components/BlockSummary';
import { Callout } from '@/app/components/Callout';
import { Card } from '@/app/components/Card';
import { GradePill } from '@/app/components/GradePill';
import { HoldMark } from '@/app/components/HoldMark';
import { ProgressBar } from '@/app/components/ProgressBar';
import { ReadinessCard } from '@/app/components/ReadinessCard';
import { SessionCard } from '@/app/components/SessionCard';
import { Spinner } from '@/app/components/Spinner';

const CAT_LABEL: Record<string, string> = {
  warmup: 'Warm-up',
  main: 'Main',
  prehab: 'Prehab',
  technique: 'Technique',
  cooldown: 'Cooldown',
};

function todayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function TodayPage() {
  const router = useRouter();
  const [today, setToday] = useState<TodayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repo = new DexieClimbRepo();
    // First run has no profile yet — send the climber to onboarding instead of
    // silently adopting someone else's defaults (BC-06).
    void repo
      .getProfile()
      .then((profile) => {
        if (!profile) {
          router.replace('/profile');
          return;
        }
        return getTodaySession(repo).then(setToday);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load session');
      });
  }, [router]);

  if (error) {
    return (
      <main className="space-y-4 p-5">
        <Callout tone="danger" title="Couldn't load today's session">
          {error}
        </Callout>
      </main>
    );
  }
  if (!today) return <Spinner label="Loading today's session…" />;

  const { session, changes, warmupMandatory, neutralAssumed, readiness, consistency } = today;
  const isRest = session.type === 'rest';
  const streak = consistency.currentStreakWeeks;

  return (
    <main className="space-y-4 p-5">
      <header className="flex items-center justify-between pt-1">
        <div>
          <div className="bc-eyebrow">{todayLabel(new Date())}</div>
          <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Today</h1>
        </div>
        <HoldMark color="tangerine" size={44} rotate={-8} />
      </header>

      <SessionCard
        type={session.type}
        title={isRest ? 'Rest day' : 'Today you climb'}
        meta={
          isRest
            ? 'Recover and come back stronger.'
            : `${String(session.blocks.length)} blocks · ~60 min`
        }
      >
        {isRest ? (
          <Link href="/exercises" className="bc-btn bc-btn--secondary bc-btn--full">
            See mobility &amp; prehab
          </Link>
        ) : (
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              icon="clipboard-check"
              fullWidth
              onClick={() => {
                router.push('/checkin');
              }}
            >
              Check-in
            </Button>
            <Button
              icon="flame"
              fullWidth
              onClick={() => {
                router.push('/session');
              }}
            >
              Start
            </Button>
          </div>
        )}
      </SessionCard>

      {/* BC-28: today's readiness read-out (only on a training day with a real
          check-in; a neutral day shows the check-in prompt below instead). */}
      {!isRest && readiness && <ReadinessCard readiness={readiness} />}

      {/* BC-40: this week's consistency — progress vs target + a supportive streak. */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-2">
          <span className="bc-eyebrow">This week</span>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800 }}>
            {consistency.weekDoneCount} / {consistency.weekTarget} sessions
          </span>
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar value={consistency.weekDoneCount} max={consistency.weekTarget} />
        </div>
        {streak > 0 && (
          <p
            style={{
              marginTop: 8,
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}
          >
            🔥 {streak}-week streak — nice and consistent.
          </p>
        )}
      </Card>

      {warmupMandatory && (
        <Callout tone="warning" title="Warm-up is mandatory today.">
          Finish every warm-up block before the main set unlocks.
        </Callout>
      )}

      {!isRest && neutralAssumed && (
        <Link href="/checkin" style={{ textDecoration: 'none' }}>
          <Callout tone="info" icon="heart-pulse">
            No check-in today — assuming you feel normal. Check in →
          </Callout>
        </Link>
      )}

      {changes.length > 0 && (
        <Callout tone="brand" title="Adjusted for you" icon="sparkles">
          {changes.map((c) => (
            <div key={c.ruleId}>{c.reason}</div>
          ))}
        </Callout>
      )}

      <section className="space-y-1 pt-2">
        <div className="bc-eyebrow">The plan</div>
        {session.blocks.map((b) => (
          <div
            key={b.id}
            className="flex items-start gap-3 py-3"
            style={{ borderTop: '2px solid var(--border)' }}
          >
            <div className="min-w-0 flex-1">
              {/* BC-54: the shared block header (name + badge + target + notes), so
                  Today, the session player, and the program preview can never drift. */}
              <BlockSummary
                block={b}
                badgeLabel={CAT_LABEL[b.category] ?? b.category}
                showGrade={false}
              />
            </div>
            {b.targetGrade !== undefined ? <GradePill grade={b.targetGrade} size="sm" /> : null}
          </div>
        ))}
      </section>
    </main>
  );
}
