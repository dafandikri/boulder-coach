'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import { localDateIso } from '@/app/lib/date';
import { checkInFormValues, cycleSeverity, type CheckInFlags } from '@/app/lib/checkinForm';
import { toLoadState, type LoadState } from '@/app/lib/loadState';
import type { BodyPart, CheckIn } from '@/domain/types';
import { Card } from '@/app/components/Card';
import { Chip } from '@/app/components/Chip';
import { Button } from '@/app/components/Button';
import { Callout } from '@/app/components/Callout';
import { BackLink } from '@/app/components/BackLink';
import { Spinner } from '@/app/components/Spinner';

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

  if (load.status === 'loading') return <Spinner label="Loading your check-in…" />;
  if (load.status === 'error') {
    return (
      <main className="space-y-4 p-5">
        <BackLink href="/" label="Today" />
        <Callout tone="danger" title="Couldn't load your check-in">
          {load.message}
        </Callout>
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              setReloadKey((k) => k + 1);
            }}
          >
            Retry
          </Button>
          <Button
            fullWidth
            onClick={() => {
              router.push('/');
            }}
          >
            Back to Today
          </Button>
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
    <main className="space-y-5 p-5">
      <BackLink href="/" label="Today" />
      <header className="pt-1">
        <div className="bc-eyebrow">How are you today?</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Check-in</h1>
      </header>

      {editing && (
        <Callout tone="warning" title="Already checked in today">
          These are your saved answers — editing and saving updates today&apos;s entry.
        </Callout>
      )}

      <Card>
        <div className="space-y-4">
          {sliders.map(([label, value, set]) => (
            <label key={label} className="block">
              <span
                className="flex items-baseline justify-between"
                style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}
              >
                {label}
                <span className="bc-mono" style={{ color: 'var(--brand-deep)' }}>
                  {value}/5
                </span>
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
                style={{ marginTop: 6 }}
              />
            </label>
          ))}
        </div>
      </Card>

      <Section
        title="Soreness"
        hint="tap to cycle 1–3"
        map={soreness}
        onToggle={(k) => {
          setSoreness((m) => cycleSeverity(m, k));
        }}
      />
      <Section
        title="Pain"
        hint="tap to cycle 1–3"
        map={pain}
        onToggle={(k) => {
          setPain((m) => cycleSeverity(m, k));
        }}
      />

      <Button
        variant="success"
        size="lg"
        icon="check"
        fullWidth
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? 'Saving…' : editing ? 'Update check-in' : 'Save check-in'}
      </Button>
    </main>
  );
}

function Section({
  title,
  hint,
  map,
  onToggle,
}: {
  title: string;
  hint: string;
  map: CheckInFlags;
  onToggle: (key: BodyPart) => void;
}) {
  return (
    <section>
      <p className="bc-eyebrow" style={{ marginBottom: 8 }}>
        {title} · {hint}
      </p>
      <div className="flex flex-wrap gap-2">
        {PARTS.map((p) => {
          const severity = map[p.key];
          return (
            <Chip
              key={p.key}
              selected={severity !== undefined}
              onClick={() => {
                onToggle(p.key);
              }}
            >
              {p.label}
              {severity ? ` · ${String(severity)}/3` : ''}
            </Chip>
          );
        })}
      </div>
    </section>
  );
}
