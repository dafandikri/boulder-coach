// scripts/crew/lib/review.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Run the reviewer agent (Claude by default) and parse its VERDICT line.
 * @param {string} branch
 * @param {string} pbiId
 * @returns {{verdict: 'approve'|'flag', reason?: string}}
 */
export function runReviewer(branch, pbiId) {
  const prompt = readFileSync(join(process.cwd(), 'scripts/crew/prompts/reviewer.md'), 'utf8')
    .replace(/{{PBI_ID}}/g, pbiId)
    .replace(/{{BRANCH}}/g, branch);
  const out = execFileSync('claude', ['--print', prompt], { encoding: 'utf8' });
  const line = out.split('\n').reverse().find((l) => l.includes('VERDICT:')) ?? '';
  if (/VERDICT:\s*APPROVE/i.test(line)) return { verdict: 'approve' };
  const m = line.match(/VERDICT:\s*FLAG\s*(.*)/i);
  return { verdict: 'flag', reason: m?.[1]?.trim() || 'reviewer flagged' };
}
