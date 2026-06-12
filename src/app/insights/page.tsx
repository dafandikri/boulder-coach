'use client';

import { useEffect, useState } from 'react';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { computeLoadMetrics } from '@/domain/loadMetrics';
import { computeInsights, summariseInsights, type Insights } from '@/domain/insights';
import { loadAdaptationLog } from '@/app/lib/bootstrap';
import type { AdaptationLogEntry } from '@/domain/types';
import { Card } from '@/app/components/Card';
import { Badge } from '@/app/components/Badge';
import { GradePill } from '@/app/components/GradePill';
import { ProgressBar } from '@/app/components/ProgressBar';
import { StatCard } from '@/app/components/StatCard';
import { Spinner } from '@/app/components/Spinner';

/** ACWR risk → brand feedback tone (presentational only; the value is domain-computed). */
function acwrTone(acwr: number): { color: string; label: string } {
  if (acwr === 0) return { color: 'var(--text-soft)', label: 'No data' };
  if (acwr > 1.5) return { color: 'var(--danger)', label: 'High risk' };
  if (acwr >= 1.3) return { color: 'var(--warning-deep)', label: 'Caution' };
  return { color: 'var(--success-deep)', label: 'Good' };
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [acwr, setAcwr] = useState(0);
  const [decisionLog, setDecisionLog] = useState<AdaptationLogEntry[]>([]);

  useEffect(() => {
    async function load() {
      const repo = new DexieClimbRepo();
      const [logs, checkIns, adaptationLog] = await Promise.all([
        repo.getLogs(),
        repo.getCheckIns(),
        loadAdaptationLog(repo), // already sorted newest-first (BC-07)
      ]);
      const metrics = computeLoadMetrics(logs, new Date());
      setAcwr(metrics.acwr);
      setInsights(computeInsights(logs, checkIns));
      setDecisionLog(adaptationLog);
    }
    void load();
  }, []);

  if (!insights) return <Spinner label="Loading insights…" />;

  const tone = acwrTone(acwr);
  const maxCount = Math.max(1, ...insights.gradePyramid.map((e) => e.count));
  const summary = summariseInsights(insights, acwr, new Date());

  return (
    <main className="space-y-4 p-5">
      <header className="pt-1">
        <div className="bc-eyebrow">Your trends</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Insights</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon="activity"
          tone={tone.color}
          value={acwr === 0 ? '—' : acwr.toFixed(2)}
          label="ACWR"
          sub={tone.label}
        />
        <StatCard
          icon="trending-up"
          value={insights.totalSessions}
          label="Sessions"
          sub={`Avg RPE ${String(insights.averageSessionRPE)}`}
        />
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-soft)', marginTop: -4 }}>
        ACWR target 0.8–1.3. Above 1.5 forces a deload.
      </p>

      <Card accent="var(--brand)">
        <div className="bc-eyebrow" style={{ marginBottom: 8 }}>
          Coach’s read
        </div>
        <div className="space-y-2">
          {summary.map((line, i) => (
            <p key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text)', lineHeight: 1.45 }}>
              {line}
            </p>
          ))}
        </div>
      </Card>

      {insights.gradePyramid.length > 0 && (
        <Card>
          <div className="bc-eyebrow" style={{ marginBottom: 10 }}>
            Grade pyramid (sends)
          </div>
          <div className="space-y-2">
            {insights.gradePyramid.toReversed().map((entry) => (
              <div key={entry.grade} className="flex items-center gap-3">
                <div style={{ width: 44, flex: 'none' }}>
                  <GradePill grade={entry.grade} size="sm" />
                </div>
                <div className="flex-1">
                  <ProgressBar value={entry.count} max={maxCount} height={12} />
                </div>
                <span
                  className="bc-mono"
                  style={{
                    width: 22,
                    textAlign: 'right',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                  }}
                >
                  {entry.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {insights.sorenessTrends.length > 0 && (
        <Card>
          <div className="bc-eyebrow" style={{ marginBottom: 10 }}>
            Soreness &amp; pain log
          </div>
          <ul className="space-y-2">
            {insights.sorenessTrends.toReversed().map((t, i) => (
              <li
                key={`${t.date}-${t.bodyPart}-${String(i)}`}
                className="flex items-center justify-between gap-2"
              >
                <span
                  className="bc-mono"
                  style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-soft)' }}
                >
                  {t.date}
                </span>
                <Badge tone={t.type === 'pain' ? 'danger' : 'warning'}>
                  {t.bodyPart} · {t.severity}/3
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {decisionLog.length > 0 && (
        <Card>
          <div className="bc-eyebrow" style={{ marginBottom: 10 }}>
            The “why” log
          </div>
          <ul className="space-y-3">
            {decisionLog.map((entry) => (
              <li
                key={entry.date}
                style={{ borderTop: '2px solid var(--border)', paddingTop: 10 }}
                className="first:border-t-0 first:pt-0"
              >
                <p
                  className="bc-mono"
                  style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-soft)' }}
                >
                  {entry.date}
                </p>
                {entry.changes.length > 0 ? (
                  entry.changes.map((c) => (
                    <p key={c.ruleId} style={{ fontSize: 'var(--fs-sm)', color: 'var(--text)' }}>
                      • {c.reason}
                    </p>
                  ))
                ) : (
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    No adjustments — session ran as planned.
                  </p>
                )}
                {entry.neutralAssumed && (
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-soft)' }}>
                    No check-in — assumed neutral.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
