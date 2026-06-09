'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getDrillsByCategory, type SkillCategory } from '@/domain/drills';

export default function DrillsPage() {
  const [tab, setTab] = useState<SkillCategory>('technique');

  const drills = getDrillsByCategory(tab);

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <Link href="/" className="text-sm text-gray-500">
        &larr; Today
      </Link>
      <h1 className="text-2xl font-bold">Drills</h1>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setTab('technique');
          }}
          className={`rounded-full px-4 py-1 text-sm font-medium ${tab === 'technique' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Technique
        </button>
        <button
          onClick={() => {
            setTab('prehab');
          }}
          className={`rounded-full px-4 py-1 text-sm font-medium ${tab === 'prehab' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          Prehab
        </button>
      </div>

      <div className="space-y-3">
        {drills.map((d) => (
          <article key={d.id} className="rounded-lg border p-4">
            <h2 className="font-semibold">{d.name}</h2>
            <p className="mt-1 text-sm text-gray-600">{d.description}</p>
            {d.cues.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {d.cues.map((cue, i) => (
                  <li key={i} className="text-xs text-gray-500">
                    &bull; {cue}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
