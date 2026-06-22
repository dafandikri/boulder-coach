'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRepo } from '@/data/repoInstance';
import { localDateIso } from '@/app/lib/date';
import { expandTally } from '@/app/lib/sessionForm';
import {
  validateQuickLog,
  buildQuickLogInput,
  gradeBand,
  type QuickLogForm,
} from '@/app/lib/quickLog';
import { createSessionLog } from '@/domain/sessionLog';
import type { VGrade } from '@/domain/types';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';
import { Callout } from '@/app/components/Callout';
import { GradePill } from '@/app/components/GradePill';
import { BackLink } from '@/app/components/BackLink';

type Tally = Partial<Record<VGrade, number>>;

export default function QuickLogPage() {
  const router = useRouter();
  const [date, setDate] = useState(() => localDateIso(new Date()));
  const [durationMin, setDurationMin] = useState(60);
  const [sessionRPE, setSessionRPE] = useState(6);
  const [sends, setSends] = useState<Tally>({});
  const [notes, setNotes] = useState('');
  const [band, setBand] = useState<VGrade[]>(() => gradeBand(5));
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const repo = getRepo();
    void repo.getLogs().then((logs) => {
      setExistingIds(logs.map((l) => l.id));
    });
    void repo.getProfile().then((p) => {
      if (p) setBand(gradeBand(p.currentGrade));
    });
  }, []);

  function adjustSend(grade: VGrade, delta: number): void {
    setSends((prev) => ({ ...prev, [grade]: Math.max(0, (prev[grade] ?? 0) + delta) }));
  }

  async function save(): Promise<void> {
    const form: QuickLogForm = {
      date,
      durationMin,
      sessionRPE,
      gradesSent: expandTally(sends),
      notes: notes.trim() === '' ? undefined : notes.trim(),
    };
    const problem = validateQuickLog(form);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await getRepo().saveLog(createSessionLog(buildQuickLogInput(form, existingIds)));
      router.push('/history');
    } catch {
      setSaving(false);
      setError('Could not save — please try again.');
    }
  }

  return (
    <main className="space-y-4 p-5">
      <BackLink href="/" label="Today" />
      <header className="pt-1">
        <div className="bc-eyebrow">Off-plan or rest-day climbing</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Log a session</h1>
        <p style={{ marginTop: 4, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          Climbed outside your plan? Log it so your load, streak, and insights stay honest.
        </p>
      </header>

      {error && <Callout tone="danger">{error}</Callout>}

      <Card>
        <label className="block" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
            }}
            style={{
              display: 'block',
              marginTop: 6,
              borderRadius: 'var(--r-sm)',
              border: '2px solid var(--border)',
              background: 'var(--surface)',
              padding: '6px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-sm)',
            }}
          />
        </label>

        <label
          className="block"
          style={{ marginTop: 14, fontSize: 'var(--fs-sm)', fontWeight: 700 }}
        >
          Duration (minutes)
          <input
            type="number"
            min={1}
            max={600}
            value={durationMin}
            onChange={(e) => {
              setDurationMin(Math.trunc(Number(e.target.value)));
            }}
            style={{
              display: 'block',
              marginTop: 6,
              width: 96,
              borderRadius: 'var(--r-sm)',
              border: '2px solid var(--border)',
              background: 'var(--surface)',
              padding: '6px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-sm)',
            }}
          />
        </label>

        <label className="block" style={{ marginTop: 14 }}>
          <span
            className="flex items-baseline justify-between"
            style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}
          >
            Session RPE
            <span className="bc-mono" style={{ color: 'var(--brand-deep)' }}>
              {sessionRPE}/10
            </span>
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={sessionRPE}
            onChange={(e) => {
              setSessionRPE(Number(e.target.value));
            }}
            className="w-full"
            aria-label="Session RPE"
            style={{ marginTop: 6 }}
          />
        </label>
      </Card>

      <Card>
        <div className="bc-eyebrow" style={{ marginBottom: 8 }}>
          Sends (optional)
        </div>
        <div className="space-y-1.5">
          {band.map((g) => (
            <div
              key={g}
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: '3rem 1fr' }}
            >
              <GradePill grade={g} size="sm" />
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="minus"
                  aria-label={`One fewer send at grade ${g}`}
                  onClick={() => {
                    adjustSend(g, -1);
                  }}
                />
                <span className="bc-mono" style={{ minWidth: 16, textAlign: 'center' }}>
                  {sends[g] ?? 0}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  aria-label={`One more send at grade ${g}`}
                  onClick={() => {
                    adjustSend(g, 1);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <label className="block" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
          Note (optional)
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
            rows={3}
            placeholder="Felt strong on overhangs…"
            style={{
              display: 'block',
              marginTop: 6,
              width: '100%',
              borderRadius: 'var(--r-sm)',
              border: '2px solid var(--border)',
              background: 'var(--surface)',
              padding: '8px 10px',
              fontSize: 'var(--fs-sm)',
            }}
          />
        </label>
      </Card>

      <Button
        fullWidth
        size="lg"
        icon="check"
        disabled={saving}
        onClick={() => {
          void save();
        }}
      >
        {saving ? 'Saving…' : 'Save session'}
      </Button>
    </main>
  );
}
