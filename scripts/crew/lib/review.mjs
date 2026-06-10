// @ts-check
// scripts/crew/lib/review.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @typedef {import('./route.mjs').Verdict} Verdict */

/**
 * Run the reviewer agent and parse its VERDICT line. FAIL-SAFE: any failure
 * (agent binary missing, non-zero exit, unparseable output) returns a FLAG, so a
 * broken reviewer routes the branch to a human instead of stranding the claim or
 * silently auto-merging. TOOL-NEUTRAL: the one-shot agent argv is injected
 * (`config.aiAgent`), so a Codex/Aider shop isn't forced to have `claude`.
 * @param {string} branch
 * @param {string} pbiId
 * @param {string[]} [aiAgent] argv for a one-shot prompt agent; the prompt is appended
 * @returns {Verdict}
 */
export function runReviewer(branch, pbiId, aiAgent = ['claude', '--print']) {
  try {
    const [cmd, ...args] = aiAgent;
    if (!cmd) return { verdict: 'flag', reason: 'no reviewer agent configured' };
    const prompt = readFileSync(join(process.cwd(), 'scripts/crew/prompts/reviewer.md'), 'utf8')
      .replace(/{{PBI_ID}}/g, pbiId)
      .replace(/{{BRANCH}}/g, branch);
    const out = execFileSync(cmd, [...args, prompt], { encoding: 'utf8' });
    const line =
      out
        .split('\n')
        .reverse()
        .find((l) => l.includes('VERDICT:')) ?? '';
    if (/VERDICT:\s*APPROVE/i.test(line)) return { verdict: 'approve' };
    const m = line.match(/VERDICT:\s*FLAG\s*(.*)/i);
    return { verdict: 'flag', reason: m?.[1]?.trim() || 'reviewer flagged' };
  } catch (err) {
    return {
      verdict: 'flag',
      reason: `reviewer unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
