'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { localDateIso } from '@/app/lib/date';
import { checkInFormValues, cycleSeverity, type CheckInFlags } from '@/app/lib/checkinForm';
import { toLoadState, type LoadState } from '@/app/lib/loadState';
import type { BodyPart, CheckIn } from '@/domain/types';

const PARTS: { key: BodyPart; label: string }[] = [
  { key: 'pip', label: 'Finger (PIP)' },
  { key: 'wrist-tfcc', label: 'Wrist (TFCC)' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'elbow', label: 'Elbow' },
];

export default function CheckInPage() {
  const router = useRouter();
  // The existing check-in for today (if any) drives the prefill. `loading`/`error`
  // here replace the old silent path that started blank and overwrote any entry.
  const [load, setLoad] = useState<LoadState<CheckIn | undefined>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  const [editing, setEditing] = useState(false);
  const [sleepQuality, setSleep] = useState(4);
  const [overallFatigue, setFatigue] = useState(2);
  const [motivation, setMotivation] = useState(4);
  const [soreness, setSoreness] = useState<CheckInFlags>({});
  const [pain, setPain] = useState<CheckInFlags>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = localDateIso(new Date());
    void new DexieClimbRepo().getCheckIn(today).then(
      (existing) => {
        if (cancelled) return;
        const v = checkInFormValues(existing);
        setSleep(v.sleepQuality);
        setFatigue(v.overallFatigue);
        setMotivation(v.motivation);
        setSoreness(v.soreness);
        setPain(v.pain);
        setEditing(v.editing);
        setLoad(toLoadState({ ok: true, data: existing }));
      },
      (error: unknown) => {
        if (!cancelled) setLoad(toLoadState<CheckIn | undefined>({ ok: false, error }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function save(): Promise<void> {
    setSaving(true);
    const checkIn: CheckIn = {
      date: localDateIso(new Date()),
      sleepQuality,
      overallFatigue,
      motivation,
      soreness,
      pain,
    };
    await new DexieClimbRepo().saveCheckIn(checkIn);
    router.push('/');
  }

  if (load.status === 'loading') return <main className="p-6">Loading…</main>;
  if (load.status === 'error') {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-bold">Couldn&apos;t load your check-in</h1>
        <p className="text-sm text-gray-600">{load.message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setReloadKey((k) => k + 1);
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => {
              router.push('/');
            }}
            className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
          >
            Back to Today
          </button>
        </div>
      </main>
    );
  }

  const sliders: [string, number, (n: number) => void][] = [
    ['Sleep', sleepQuality, setSleep],
    ['Fatigue', overallFatigue, setFatigue],
    ['Motivation', motivation, setMotivation],
  ];

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">Check-in</h1>
      {editing && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You already checked in today — these are your saved answers. Editing and saving will
          update today&apos;s entry.
        </p>
      )}

      {sliders.map(([label, value, set]) => (
        <label key={label} className="block">
          <span className="text-sm font-medium">
            {label}: {value}
          </span>
          <input
            type="range"
            min={1}
            max={5}
            value={value}
            onChange={(e) => {
              set(Number(e.target.value));
            }}
            className="w-full"
          />
        </label>
      ))}

      <Section
        title="Soreness (tap to cycle 1–3)"
        map={soreness}
        onToggle={(k) => {
          setSoreness((m) => cycleSeverity(m, k));
        }}
      />
      <Section
        title="Pain (tap to cycle 1–3)"
        map={pain}
        onToggle={(k) => {
          setPain((m) => cycleSeverity(m, k));
        }}
      />

      <button
        onClick={() => void save()}
        disabled={saving}
        className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : editing ? 'Update check-in' : 'Save check-in'}
      </button>
    </main>
  );
}

function Section({
  title,
  map,
  onToggle,
}: {
  title: string;
  map: CheckInFlags;
  onToggle: (key: BodyPart) => void;
}) {
  return (
    <section>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {PARTS.map((p) => {
          const severity = map[p.key];
          return (
            <button
              key={p.key}
              onClick={() => {
                onToggle(p.key);
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${
                severity ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-300'
              }`}
            >
              {p.label}
              {severity ? ` · ${String(severity)}/3` : ''}
            </button>
          );
        })}
      </div>
    </section>
  );
}
