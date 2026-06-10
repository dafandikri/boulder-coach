// @ts-check
// scripts/crew/lib/route.mjs
/** @typedef {{ verdict: 'approve'|'flag', reason?: string }} Verdict */

/**
 * Decide how a finished worker's green-gate branch should be handled. Pure: the
 * conductor runs the I/O (merge or enqueue) based on this verdict. Fail-safe —
 * anything other than (auto-tier AND reviewer-approve) routes to the human queue.
 * @param {'auto'|'review'} tier
 * @param {Verdict|null} verdict reviewer verdict, or null if the reviewer did not run
 * @returns {{ action: 'merge'|'queue', reason?: string }}
 */
export function decideAction(tier, verdict) {
  if (tier !== 'auto') return { action: 'queue', reason: 'tier=review' };
  if (!verdict) return { action: 'queue', reason: 'no reviewer verdict' };
  if (verdict.verdict === 'approve') return { action: 'merge' };
  return { action: 'queue', reason: verdict.reason ?? 'reviewer flagged' };
}
