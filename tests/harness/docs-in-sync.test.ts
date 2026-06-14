import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// Tier-1 guard: docs that quote a machine-checkable threshold MUST stay in sync with the
// config that owns it. This promotes the "Documentation discipline = same commit" rule
// (AGENTS.md) from prose to an executable check, after a real lapse: PR #44 ratcheted the
// coverage/lighthouse/mutation floors but shipped with the rule docs still quoting the old
// numbers — the gate stayed green and the docs were only corrected in a *separate* PR #45.
// Now, changing a threshold without updating the doc that states it fails the gate by name.
// (LEARNINGS 2026-06-14 "enforce docs".)
//
// Scope: only numbers that live in BOTH a config (the source of truth) AND a doc as an
// explicit value. We read the number from the config and assert the doc quotes the same one.
const root = process.cwd();
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

/** The single line of `text` that contains `anchor` — keeps number lookups local so a
 *  stray digit elsewhere in the file (a date, another threshold) can't be mismatched. */
function lineWith(text: string, anchor: string): string {
  const found = text.split('\n').find((l) => l.includes(anchor));
  if (found === undefined) {
    throw new Error(`docs-in-sync: no line contains "${anchor}" — did the doc wording change?`);
  }
  return found;
}

/** First number appearing after `label` within `haystack` (skips a `≥ ` style separator). */
function num(haystack: string, label: string): number {
  const m = new RegExp(`${label}[^\\d]*([\\d.]+)`).exec(haystack);
  if (!m)
    throw new Error(`docs-in-sync: could not find "${label} <number>" near the anchored line.`);
  return Number(m[1]);
}

describe('docs stay in sync with the configs they quote (enforce docs discipline)', () => {
  it('README Lighthouse budgets match lighthouserc.json', () => {
    const lh = JSON.parse(read('lighthouserc.json')) as {
      ci: { assert: { assertions: Record<string, [string, { minScore: number }]> } };
    };
    const a = lh.ci.assert.assertions;
    const row = lineWith(read('README.md'), 'Lighthouse category budgets');
    expect(num(row, 'perf')).toBe(a['categories:performance']![1].minScore);
    expect(num(row, 'a11y')).toBe(a['categories:accessibility']![1].minScore);
    expect(num(row, 'best-practices')).toBe(a['categories:best-practices']![1].minScore);
    expect(num(row, 'SEO')).toBe(a['categories:seo']![1].minScore);
  });

  it('README mutation score matches stryker.config.json break threshold', () => {
    const stryker = JSON.parse(read('stryker.config.json')) as { thresholds: { break: number } };
    const row = lineWith(read('README.md'), 'Stryker mutation score');
    expect(num(row, 'mutation score')).toBe(stryker.thresholds.break);
  });

  it('CLAUDE.md coverage floors match vitest.config.ts', () => {
    const cfg = read('vitest.config.ts');
    const domainBranch = num(cfg, "'src/domain/\\*\\*':\\s*\\{[^}]*branches:");
    const globalBranch = num(cfg, 'global:\\s*\\{[^}]*branches:');
    const row = lineWith(read('CLAUDE.md'), 'rest of domain');
    expect(num(row, 'rest of domain ≥')).toBe(domainBranch);
    expect(num(row, 'everything else ≥')).toBe(globalBranch);
  });
});
