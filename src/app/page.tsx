'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { getTodaySession, type TodayResult } from '@/app/lib/bootstrap';

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
    return <main className="p-6 text-red-600">Error: {error}</main>;
  }
  if (!today) {
    return <main className="p-6">Loading today’s session…</main>;
  }

  const { session, changes, warmupMandatory } = today;
  const isRest = session.type === 'rest';

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm capitalize text-gray-500">
          {isRest ? 'Rest day' : session.type.replace('-', ' ')}
        </p>
      </header>

      {isRest ? (
        <section className="space-y-1 rounded-lg bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">🧘 Rest day — recover and come back stronger.</p>
          <p>No climbing load today. Light mobility, antagonist/prehab, and good sleep.</p>
        </section>
      ) : (
        <div className="flex gap-3">
          <Link href="/checkin" className="rounded-lg border px-4 py-2 text-sm font-medium">
            Check-in
          </Link>
          <Link
            href="/session"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Start session
          </Link>
        </div>
      )}

      {changes.length > 0 && (
        <section className="space-y-1 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Adjusted for you:</p>
          {changes.map((c) => (
            <p key={c.ruleId}>• {c.reason}</p>
          ))}
        </section>
      )}

      {warmupMandatory && (
        <p className="rounded bg-red-100 px-3 py-2 text-sm font-medium text-red-800">
          Warm-up is mandatory today.
        </p>
      )}

      <ol className="space-y-3">
        {session.blocks.map((b) => (
          <li key={b.id} className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{b.name}</span>
              <span className="text-xs uppercase text-gray-400">{b.category}</span>
            </div>
            <p className="text-sm text-gray-600">
              {b.sets} × {b.grip}
              {b.targetGrade !== undefined ? ` · V${b.targetGrade}` : ''} · RPE {b.targetRPE}
            </p>
            {b.notes && <p className="mt-1 text-xs text-gray-500">{b.notes}</p>}
          </li>
        ))}
      </ol>

      <nav className="grid grid-cols-2 gap-2 border-t pt-4 text-center text-sm">
        <Link href="/history" className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50">
          History
        </Link>
        <Link href="/insights" className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50">
          Insights
        </Link>
        <Link href="/program" className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50">
          Program
        </Link>
        <Link href="/drills" className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50">
          Drills
        </Link>
        <Link
          href="/profile"
          className="col-span-2 rounded-lg border p-2 text-gray-600 hover:bg-gray-50"
        >
          Profile
        </Link>
      </nav>
    </main>
  );
}
