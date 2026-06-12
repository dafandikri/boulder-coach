'use client';

import { useState } from 'react';
import { getDrillsByCategory, getDrill, type SkillCategory } from '@/domain/drills';
import { hasRichContent } from '@/domain/exerciseContent';
import { Card } from '@/app/components/Card';
import { Chip } from '@/app/components/Chip';
import { Button } from '@/app/components/Button';
import { BackLink } from '@/app/components/BackLink';
import { ExerciseDetail } from '@/app/components/ExerciseDetail';

const TABS: { key: SkillCategory; label: string; icon: 'target' | 'shield' }[] = [
  { key: 'technique', label: 'Technique', icon: 'target' },
  { key: 'prehab', label: 'Prehab', icon: 'shield' },
];

export default function DrillsPage() {
  const [tab, setTab] = useState<SkillCategory>('technique');
  const [openId, setOpenId] = useState<string | null>(null);

  const open = openId ? getDrill(openId) : undefined;

  // Detail view — full step-by-step + image (BC-46/BC-49).
  if (open) {
    return (
      <main className="space-y-4 p-5">
        <button
          type="button"
          onClick={() => {
            setOpenId(null);
          }}
          className="bc-eyebrow"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--brand-deep)' }}
        >
          ← All drills
        </button>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>{open.description}</p>
        <Card>
          <ExerciseDetail title={open.name} content={open} />
        </Card>
      </main>
    );
  }

  const drills = getDrillsByCategory(tab);

  return (
    <main className="space-y-4 p-5">
      <BackLink href="/" label="Today" />
      <header className="pt-1">
        <div className="bc-eyebrow">Skill library</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Drills</h1>
      </header>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <Chip
            key={t.key}
            icon={t.icon}
            selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
            }}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="space-y-3">
        {drills.map((d) => (
          <Card key={d.id}>
            <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>{d.name}</h2>
            <p style={{ marginTop: 4, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              {d.description}
            </p>
            {d.cues.length > 0 && (
              <ul className="space-y-1" style={{ marginTop: 10 }}>
                {d.cues.map((cue, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-soft)',
                      fontWeight: 600,
                    }}
                  >
                    • {cue}
                  </li>
                ))}
              </ul>
            )}
            {hasRichContent(d) && (
              <div style={{ marginTop: 12 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="arrow-right"
                  onClick={() => {
                    setOpenId(d.id);
                  }}
                >
                  Instructions
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
