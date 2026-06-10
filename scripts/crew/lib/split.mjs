// @ts-check
// scripts/crew/lib/split.mjs
import { filesOverlap } from './schedule.mjs';

/** @typedef {import('./backlog.mjs').Pbi} Pbi */
/** @typedef {import('./schedule.mjs').ActiveClaim} ActiveClaim */
/** @typedef {{ id: string, files: string[] }} Assignment */

/**
 * Turn a PBI (+ an optional manager split plan) into the list of independently
 * assignable units. A split is only honored when it is SAFE:
 *   - every sub-task file is within the PBI's declared lock,
 *   - sub-tasks are mutually file-disjoint,
 *   - the sub-tasks together cover every PBI file (complete partition).
 * Otherwise it falls back to assigning the whole PBI. In all cases, units whose
 * files overlap an active claim are dropped so the disjoint-lock invariant holds.
 * @param {Pbi} pbi
 * @param {Assignment[]} split
 * @param {ActiveClaim[]} active
 * @returns {Assignment[]}
 */
export function planAssignments(pbi, split, active) {
  const whole = [{ id: pbi.id, files: pbi.files }];
  const units = isSafeSplit(pbi, split) ? split.map((s) => ({ id: s.id, files: s.files })) : whole;
  const locked = active.flatMap((c) => c.files);
  return units.filter((u) => !filesOverlap(u.files, locked));
}

/**
 * @param {Pbi} pbi
 * @param {Assignment[]} split
 * @returns {boolean}
 */
function isSafeSplit(pbi, split) {
  if (split.length === 0) return false;
  const pbiFiles = new Set(pbi.files);
  const seen = new Set();
  for (const sub of split) {
    if (sub.files.length === 0) return false;
    for (const f of sub.files) {
      if (!pbiFiles.has(f)) return false; // outside the PBI lock
      if (seen.has(f)) return false; // overlaps another sub-task
      seen.add(f);
    }
  }
  return seen.size === pbiFiles.size; // complete cover of every PBI file
}
