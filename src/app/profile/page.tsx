'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DexieClimbRepo } from '@/data/dexieRepo';
import {
  DEFAULT_PROFILE,
  applyProfile,
  validateProfile,
  type ProfileDraft,
} from '@/app/lib/bootstrap';
import { exportBackup, importBackup, backupFilename, BackupError } from '@/app/lib/backup';
import { Card } from '@/app/components/Card';
import { Chip } from '@/app/components/Chip';
import { Button } from '@/app/components/Button';
import { Callout } from '@/app/components/Callout';
import { HoldMark } from '@/app/components/HoldMark';
import { Spinner } from '@/app/components/Spinner';
import { VB, MAX_GRADE, formatGrade } from '@/domain/grade';
import type { CSSProperties } from 'react';

const WEEKDAYS: { n: number; label: string }[] = [
  { n: 0, label: 'Sun' },
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
];

// VB(-1), V0, V1 … V17 — the beginner floor (BC-44) is selectable.
const GRADES: number[] = Array.from({ length: MAX_GRADE - VB + 1 }, (_, i) => VB + i);
const SESSION_OPTIONS: number[] = [2, 3, 4];

const SELECT_STYLE: CSSProperties = {
  width: '100%',
  borderRadius: 'var(--r-md)',
  border: '2px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 'var(--fs-base)',
  padding: '10px 12px',
};

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
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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

  // --- Backup wiring (BC-10). All logic lives in backup.ts; this only does the
  // browser-only I/O: serialize→download, pick file→read text, and the confirm
  // before a destructive import. ---

  async function exportData(): Promise<void> {
    const backup = await exportBackup(new DexieClimbRepo());
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg('Backup downloaded.');
  }

  async function importData(file: File): Promise<void> {
    if (!window.confirm('Importing replaces ALL current data on this device. Continue?')) return;
    try {
      await importBackup(new DexieClimbRepo(), await file.text());
      router.push('/');
    } catch (e) {
      setBackupMsg(e instanceof BackupError ? e.message : 'Import failed: unreadable file.');
    }
  }

  if (!loaded) return <Spinner label="Loading your profile…" />;

  return (
    <main className="space-y-5 p-5">
      <header className="flex items-center justify-between pt-1">
        <div>
          <div className="bc-eyebrow">{isFirstRun ? 'Welcome' : 'Settings'}</div>
          <h1 style={{ fontSize: 'var(--fs-2xl)' }}>
            {isFirstRun ? 'Let’s set you up' : 'Your profile'}
          </h1>
        </div>
        {isFirstRun ? (
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 48,
              height: 48,
              flex: 'none',
              backgroundImage: 'url(/logo-mark.svg)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <HoldMark color="sky" size={44} rotate={-8} />
        )}
      </header>

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: -8 }}>
        {isFirstRun
          ? 'Tell us where you are so the plan adapts to you, not someone else’s defaults.'
          : 'Update your details. Editing can rebuild your training cycle.'}
      </p>

      <Card>
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Current grade</span>
            <select
              style={SELECT_STYLE}
              value={draft.currentGrade}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, currentGrade: Number(e.target.value) }));
              }}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {formatGrade(g)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Goal grade</span>
            <select
              style={SELECT_STYLE}
              value={draft.goalGrade}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, goalGrade: Number(e.target.value) }));
              }}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {formatGrade(g)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Sessions per week</span>
            <select
              style={SELECT_STYLE}
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

          <fieldset className="space-y-2" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, padding: 0 }}>
              Training days
            </legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <Chip
                  key={d.n}
                  selected={draft.availableWeekdays.includes(d.n)}
                  onClick={() => {
                    toggleDay(d.n);
                  }}
                >
                  {d.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      {!isFirstRun && (
        <label
          className="flex items-start gap-2"
          style={{
            background: 'var(--warning-tint)',
            border: '2px solid var(--warning)',
            borderRadius: 'var(--r-md)',
            padding: 12,
            fontSize: 'var(--fs-sm)',
            color: 'var(--warning-deep)',
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={regenerate}
            onChange={(e) => {
              setRegenerate(e.target.checked);
            }}
            style={{ marginTop: 3, accentColor: 'var(--brand)' }}
          />
          <span>
            Rebuild my training program from these settings.{' '}
            <strong>This replaces your current cycle</strong> and starts a fresh one from today.
          </span>
        </label>
      )}

      {error && <Callout tone="danger" title={error} />}

      <Button
        size="lg"
        icon={isFirstRun ? 'flame' : 'check'}
        fullWidth
        disabled={error !== null || saving}
        onClick={() => {
          void save();
        }}
      >
        {isFirstRun ? 'Start training' : 'Save'}
      </Button>

      {!isFirstRun && (
        <section
          className="space-y-3"
          style={{ borderTop: '2px solid var(--border)', paddingTop: 20 }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>Backup &amp; restore</h2>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 2 }}>
              Your data lives only in this browser. Export a JSON backup, or import one to restore
              it on a new device.
            </p>
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              icon="download"
              fullWidth
              onClick={() => {
                void exportData();
              }}
            >
              Export
            </Button>
            <Button
              variant="secondary"
              icon="upload"
              fullWidth
              onClick={() => fileInput.current?.click()}
            >
              Import
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // allow re-picking the same file
              if (file) void importData(file);
            }}
          />
          {backupMsg && (
            <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>
              {backupMsg}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
