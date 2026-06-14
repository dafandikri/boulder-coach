'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import {
  getTodaySession,
  applyProfile,
  levelUpProfile,
  type TodayResult,
} from '@/app/lib/bootstrap';
import type { UserProfile } from '@/domain/types';
import { formatGrade } from '@/domain/grade';
import {
  shouldNudgeBackup,
  countSessionsSince,
  isSnoozed,
  snoozeUntilIso,
  LAST_EXPORT_KEY,
  NUDGE_SNOOZE_KEY,
} from '@/app/lib/backupReminder';
import { requestPersistence, shouldWarnEviction, EVICTION_DISMISS_KEY } from '@/app/lib/storage';
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
import {
  MetricExplainer,
  AcwrBandDiagram,
  RpeScaleDiagram,
} from '@/app/components/MetricExplainer';
import { explainAcwr, explainRpe } from '@/app/lib/explainers';

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupNudge, setBackupNudge] = useState(false);
  const [evictionWarn, setEvictionWarn] = useState(false);

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
        setProfile(profile);
        return getTodaySession(repo).then(setToday);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load session');
      });
  }, [router]);

  // BC-34: decide whether to surface the "back up your data" nudge. The decision
  // is the covered, tested domain rule; the page only reads logs + localStorage.
  useEffect(() => {
    const repo = new DexieClimbRepo();
    void repo.getLogs().then((logs) => {
      const now = new Date();
      const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
      const snooze = localStorage.getItem(NUDGE_SNOOZE_KEY);
      const since = countSessionsSince(
        logs.map((l) => l.date),
        lastExport,
      );
      setBackupNudge(shouldNudgeBackup(lastExport, now, since) && !isSnoozed(snooze, now));
    });
  }, []);

  function dismissBackupNudge(): void {
    localStorage.setItem(NUDGE_SNOOZE_KEY, snoozeUntilIso(new Date()));
    setBackupNudge(false);
  }

  // BC-31: ask the browser to make IndexedDB durable on load, then warn if it
  // refused. The persistence/decision logic is the covered, tested helper; the
  // page only feeds in `navigator.storage` and reads the dismissal flag.
  useEffect(() => {
    void requestPersistence(navigator.storage).then((state) => {
      const dismissed = localStorage.getItem(EVICTION_DISMISS_KEY) === '1';
      setEvictionWarn(shouldWarnEviction(state, dismissed));
    });
  }, []);

  function dismissEvictionWarn(): void {
    localStorage.setItem(EVICTION_DISMISS_KEY, '1');
    setEvictionWarn(false);
  }

  // BC-27: the climber confirmed a measured level-up. Re-anchor the profile at the
  // new grade and regenerate the next mesocycle (BC-06's regen path), then reload
  // Today so it reflects the recalibrated program. The "new draft" decision lives
  // in the covered helper — the page only wires the confirmed action.
  function applyLevelUp(): void {
    if (!profile || today === null || today.assessment.measuredGrade === null) return;
    const draft = levelUpProfile(profile, today.assessment.measuredGrade);
    const repo = new DexieClimbRepo();
    void applyProfile(repo, draft, true)
      .then(() => {
        setProfile(draft);
        return getTodaySession(repo).then(setToday);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to update your grade');
      });
  }

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

  const { session, changes, warmupMandatory, neutralAssumed, readiness, consistency, acwr } = today;
  const { dataIssues } = today;
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

      {/* Plain-language explainers for the two metrics climbers ask about most —
          load ramp (ACWR, personalised to today's ratio) and effort (RPE). Copy +
          band logic live in the covered `explainers` lib; this only renders. */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-2">
          <span className="bc-eyebrow">Load ratio (ACWR)</span>
          <MetricExplainer
            explainer={explainAcwr(acwr)}
            diagram={<AcwrBandDiagram acwr={acwr} />}
          />
        </div>
        <div className="flex items-center justify-between gap-2" style={{ marginTop: 6 }}>
          <span className="bc-eyebrow">Effort (RPE)</span>
          <MetricExplainer explainer={explainRpe()} diagram={<RpeScaleDiagram />} />
        </div>
      </Card>

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

      {/* BC-27: recent sends measure above the recorded grade — offer to re-anchor
          the program. Never auto-applies; the decision/threshold are domain-tested. */}
      {today.assessment.leveledUp && today.assessment.measuredGrade !== null && (
        <Callout tone="success" title="You’ve leveled up!" icon="trending-up">
          <p style={{ marginBottom: 8 }}>
            You’ve sent {formatGrade(today.assessment.measuredGrade)} in a few recent sessions.
            Update your grade to {formatGrade(today.assessment.measuredGrade)} so the program scales
            from your real level?
          </p>
          <div className="flex gap-2.5">
            <button type="button" className="bc-btn bc-btn--success" onClick={applyLevelUp}>
              Update to {formatGrade(today.assessment.measuredGrade)}
            </button>
          </div>
        </Callout>
      )}

      {/* BC-32: one or more stored logs failed integrity validation on read — they
          were quarantined so they can't crash the app. Offer a backup re-import. */}
      {dataIssues > 0 && (
        <Callout tone="danger" title="Some saved data looks damaged" icon="triangle-alert">
          <p style={{ marginBottom: 8 }}>
            {dataIssues} record{dataIssues === 1 ? '' : 's'} couldn’t be read and{' '}
            {dataIssues === 1 ? 'was' : 'were'} skipped to keep the app working. Re-import a recent
            backup to restore {dataIssues === 1 ? 'it' : 'them'}.
          </p>
          <Link href="/profile" className="bc-btn bc-btn--secondary">
            Restore from backup
          </Link>
        </Callout>
      )}

      {/* BC-31: the browser declined to make storage durable, so the OS may evict
          the training history under disk pressure. Decision is domain-tested. */}
      {evictionWarn && (
        <Callout tone="warning" title="Your data isn’t guaranteed to stick" icon="triangle-alert">
          <p style={{ marginBottom: 8 }}>
            This browser may clear app data to reclaim space. Export a backup to keep your training
            history safe.
          </p>
          <div className="flex gap-2.5">
            <Link href="/profile" className="bc-btn bc-btn--secondary">
              Export now
            </Link>
            <button type="button" className="bc-btn bc-btn--ghost" onClick={dismissEvictionWarn}>
              Dismiss
            </button>
          </div>
        </Callout>
      )}

      {/* BC-34: gentle, dismissible reminder to export before evictable storage
          (IndexedDB) can lose the training history. Decision is domain-tested. */}
      {backupNudge && (
        <Callout tone="info" title="Back up your training data" icon="download">
          <p style={{ marginBottom: 8 }}>
            Your history lives on this device only. Export a backup so a cleared browser can’t wipe
            it.
          </p>
          <div className="flex gap-2.5">
            <Link href="/profile" className="bc-btn bc-btn--secondary">
              Export now
            </Link>
            <button type="button" className="bc-btn bc-btn--ghost" onClick={dismissBackupNudge}>
              Remind me later
            </button>
          </div>
        </Callout>
      )}

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
