import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// `pnpm learnings` is the retrieval seam over docs/LEARNINGS.md — the project's
// long-term memory. A fresh agent must pull ONLY the entries relevant to the
// files/topic it is touching, not read the whole 350+-line ledger every session.
// This is deliberately grep/awk over markdown, NOT a vector DB: at this scale
// plain-text search is instant, dep-free, and tool-neutral (the gate is plain
// shell+git). These integration tests run the real script against the real
// ledger so the retrieval contract is Tier-1 — a regression fails the gate.
const script = join(process.cwd(), 'scripts/learnings.sh');

function learnings(...args: string[]): string {
  return execFileSync('bash', [script, ...args], { encoding: 'utf8' });
}

describe('pnpm learnings — index mode (no query)', () => {
  it('lists entry headers so topics can be scanned without reading bodies', () => {
    const out = learnings();
    // Headers from real ledger entries are present...
    expect(out).toContain('schedule.ts');
    expect(out).toContain('claude.sh');
    // ...but the entry BODIES are not (index is headers-only, the whole point).
    expect(out).not.toContain('Root cause:');
    // It teaches the lookup form.
    expect(out).toMatch(/pnpm learnings <.*>/);
  });
});

describe('pnpm learnings <keyword> — topical retrieval', () => {
  it('returns the full block of the entry that mentions the keyword in its body', () => {
    const out = learnings('network-first');
    // The matching entry's header + a distinctive body phrase are returned...
    expect(out).toContain('public/sw.js');
    expect(out).toContain('network-first');
    expect(out).toContain('Root cause:');
    // ...and unrelated entries are filtered OUT (retrieval, not full dump).
    expect(out).not.toContain('passWithNoTests');
  });

  it('still supports the original filename lookup (grep-by-file use case)', () => {
    const out = learnings('schedule.ts');
    expect(out).toContain('schedule.ts');
    expect(out).toContain('unreachable');
  });

  it('is case-insensitive', () => {
    const out = learnings('NETWORK-FIRST');
    expect(out).toContain('public/sw.js');
  });

  it('multi-word queries match across the entry text', () => {
    const out = learnings('service', 'worker');
    expect(out).toContain('public/sw.js');
  });
});

describe('pnpm learnings <keyword> — no match', () => {
  it('reports absence clearly and exits 0 (no prior mistake is not an error)', () => {
    const out = learnings('zzqqxx-not-a-real-topic');
    expect(out).toMatch(/No matching learnings/i);
  });
});
