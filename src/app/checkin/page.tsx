'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import type { BodyPart, CheckIn } from '@/domain/types';

const PARTS: { key: BodyPart; label: string }[] = [
  { key: 'pip', label: 'Finger (PIP)' },
  { key: 'wrist-tfcc', label: 'Wrist (TFCC)' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'elbow', label: 'Elbow' },
];

type Flags = Partial<Record<BodyPart, number>>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toggleFlag(map: Flags, key: BodyPart): Flags {
  if (map[key]) {
    const { [key]: _removed, ...rest } = map;
    return rest;
  }
  return { ...map, [key]: 2 };
}

export default function CheckInPage() {
  const router = useRouter();
  const [sleepQuality, setSleep] = useState(4);
  const [overallFatigue, setFatigue] = useState(2);
  const [motivation, setMotivation] = useState(4);
  const [soreness, setSoreness] = useState<Flags>({});
  const [pain, setPain] = useState<Flags>({});
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    setSaving(true);
    const checkIn: CheckIn = {
      date: todayIso(),
      sleepQuality,
      overallFatigue,
      motivation,
      soreness,
      pain,
    };
    await new DexieClimbRepo().saveCheckIn(checkIn);
    router.push('/');
  }

  const sliders: [string, number, (n: number) => void][] = [
    ['Sleep', sleepQuality, setSleep],
    ['Fatigue', overallFatigue, setFatigue],
    ['Motivation', motivation, setMotivation],
  ];

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">Check-in</h1>

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
        title="Soreness (tap)"
        map={soreness}
        onToggle={(k) => {
          setSoreness((m) => toggleFlag(m, k));
        }}
      />
      <Section
        title="Pain (tap)"
        map={pain}
        onToggle={(k) => {
          setPain((m) => toggleFlag(m, k));
        }}
      />

      <button
        onClick={() => void save()}
        disabled={saving}
        className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save check-in'}
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
  map: Flags;
  onToggle: (key: BodyPart) => void;
}) {
  return (
    <section>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {PARTS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              onToggle(p.key);
            }}
            className={`rounded-lg border px-3 py-2 text-sm ${
              map[p.key] ? 'border-red-500 bg-red-50 text-red-800' : 'border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
