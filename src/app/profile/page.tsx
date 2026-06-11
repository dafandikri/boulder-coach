'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import {
  DEFAULT_PROFILE,
  applyProfile,
  validateProfile,
  type ProfileDraft,
} from '@/app/lib/bootstrap';

const WEEKDAYS: { n: number; label: string }[] = [
  { n: 0, label: 'Sun' },
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
];

const GRADES: number[] = Array.from({ length: 17 }, (_, i) => i + 1); // V1..V17
const SESSION_OPTIONS: number[] = [2, 3, 4];

/** Onboarding (first run) and profile editing share one form. All validation and
 *  persistence live in bootstrap.ts (covered); this component only collects input
 *  and renders the single error message the validator returns. */
export default function ProfilePage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_PROFILE);
  const [isFirstRun, setIsFirstRun] = useState(true);
  const [regenerate, setRegenerate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void new DexieClimbRepo().getProfile().then((existing) => {
      if (existing) {
        setDraft(existing);
        setIsFirstRun(false);
      }
      setLoaded(true);
    });
  }, []);

  const error = validateProfile(draft);

  function toggleDay(n: number): void {
    setDraft((prev) => {
      const has = prev.availableWeekdays.includes(n);
      const next = has
        ? prev.availableWeekdays.filter((d) => d !== n)
        : [...prev.availableWeekdays, n].sort((a, b) => a - b);
      return { ...prev, availableWeekdays: next };
    });
  }

  async function save(): Promise<void> {
    if (error) return;
    setSaving(true);
    // First run always (re)builds the program; an edit only does so when the
    // climber confirmed they want to replace the current cycle.
    await applyProfile(new DexieClimbRepo(), draft, isFirstRun || regenerate);
    router.push('/');
  }

  if (!loaded) return <main className="p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">{isFirstRun ? 'Welcome 👋' : 'Your profile'}</h1>
        <p className="text-sm text-gray-500">
          {isFirstRun
            ? 'Tell us where you are so the plan adapts to you, not someone else’s defaults.'
            : 'Update your details. Editing can rebuild your training cycle.'}
        </p>
      </header>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Current grade</span>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={draft.currentGrade}
          onChange={(e) => {
            setDraft((prev) => ({ ...prev, currentGrade: Number(e.target.value) }));
          }}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              V{g}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Goal grade</span>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={draft.goalGrade}
          onChange={(e) => {
            setDraft((prev) => ({ ...prev, goalGrade: Number(e.target.value) }));
          }}
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              V{g}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Sessions per week</span>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={draft.sessionsPerWeek}
          onChange={(e) => {
            setDraft((prev) => ({ ...prev, sessionsPerWeek: Number(e.target.value) }));
          }}
        >
          {SESSION_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Training days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const on = draft.availableWeekdays.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  toggleDay(d.n);
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {!isFirstRun && (
        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={regenerate}
            onChange={(e) => {
              setRegenerate(e.target.checked);
            }}
            className="mt-0.5"
          />
          <span>
            Rebuild my training program from these settings.{' '}
            <strong>This replaces your current cycle</strong> and starts a fresh one from today.
          </span>
        </label>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="button"
        disabled={error !== null || saving}
        onClick={() => {
          void save();
        }}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {isFirstRun ? 'Start training' : 'Save'}
      </button>
    </main>
  );
}
