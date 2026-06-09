'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { computeLoadMetrics } from '@/domain/loadMetrics';
import { computeInsights, type Insights } from '@/domain/insights';

function acwrColor(acwr: number): string {
  if (acwr === 0) return 'bg-gray-200 text-gray-600';
  if (acwr > 1.5) return 'bg-red-100 text-red-800';
  if (acwr >= 1.3) return 'bg-amber-100 text-amber-800';
  return 'bg-green-100 text-green-800';
}

function acwrLabel(acwr: number): string {
  if (acwr === 0) return 'No data';
  if (acwr > 1.5) return 'High risk';
  if (acwr >= 1.3) return 'Caution';
  return 'Good';
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [acwr, setAcwr] = useState(0);

  useEffect(() => {
    async function load() {
      const repo = new DexieClimbRepo();
      const [logs, checkIns] = await Promise.all([repo.getLogs(), repo.getCheckIns()]);
      const metrics = computeLoadMetrics(logs, new Date());
      setAcwr(metrics.acwr);
      setInsights(computeInsights(logs, checkIns));
    }
    void load();
  }, []);

  if (!insights) return <main className="p-6">Loading insights&hellip;</main>;

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Today
      </Link>
      <h1 className="text-2xl font-bold">Insights</h1>

      <section className="rounded-lg border p-4">
        <p className="text-sm text-gray-500">ACWR (load ratio)</p>
        <p
          className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${acwrColor(acwr)}`}
        >
          {acwr.toFixed(2)} &mdash; {acwrLabel(acwr)}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Target: 0.8&ndash;1.3. Above 1.5 forces deload.
        </p>
      </section>

      <section className="rounded-lg border p-4">
        <p className="text-sm text-gray-500">Overall</p>
        <p className="text-lg font-semibold">{insights.totalSessions} sessions</p>
        <p className="text-sm text-gray-600">Avg session RPE: {insights.averageSessionRPE}</p>
      </section>

      {insights.gradePyramid.length > 0 && (
        <section className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">Grade pyramid (sends)</p>
          <div className="space-y-1">
            {insights.gradePyramid.toReversed().map((entry) => (
              <div key={entry.grade} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-right font-mono">V{entry.grade}</span>
                <div
                  className="h-5 rounded bg-slate-200"
                  style={{
                    width: `${Math.min(100, (entry.count / Math.max(...insights.gradePyramid.map((e) => e.count))) * 100)}%`,
                  }}
                />
                <span className="text-xs text-gray-500">{entry.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {insights.sorenessTrends.length > 0 && (
        <section className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">Soreness & pain log</p>
          <ul className="space-y-1 text-sm">
            {insights.sorenessTrends.toReversed().map((t, i) => (
              <li key={`${t.date}-${t.bodyPart}-${i}`} className="flex gap-2">
                <span className="text-xs text-gray-400">{t.date}</span>
                <span
                  className={t.type === 'pain' ? 'font-semibold text-red-700' : 'text-amber-700'}
                >
                  {t.bodyPart} ({t.severity})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
