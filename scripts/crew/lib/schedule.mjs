// @ts-check
// scripts/crew/lib/schedule.mjs
/** @typedef {import('./backlog.mjs').Pbi} Pbi */
/** @typedef {{ pbiId: string, files: string[] }} ActiveClaim */

/**
 * Do any files in `a` appear in `b`?
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
export function filesOverlap(a, b) {
  const setB = new Set(b);
  return a.some((f) => setB.has(f));
}

/**
 * Highest-priority open PBI whose deps are all done and whose files are disjoint
 * from every active claim. Null if nothing is safely assignable.
 * @param {Pbi[]} pbis
 * @param {ActiveClaim[]} active
 * @returns {Pbi|null}
 */
export function nextAssignable(pbis, active) {
  const doneIds = new Set(pbis.filter((p) => p.status === 'done').map((p) => p.id));
  const claimedIds = new Set(active.map((c) => c.pbiId));
  const lockedFiles = active.flatMap((c) => c.files);
  const candidates = pbis.filter(
    (p) =>
      p.status === 'open' &&
      !claimedIds.has(p.id) &&
      p.files.length > 0 &&
      p.dependsOn.every((d) => doneIds.has(d)) &&
      !filesOverlap(p.files, lockedFiles),
  );
  // Array.prototype.sort is stable in V8 → ties keep backlog order.
  candidates.sort((a, b) => a.priority.localeCompare(b.priority));
  return candidates[0] ?? null;
}
