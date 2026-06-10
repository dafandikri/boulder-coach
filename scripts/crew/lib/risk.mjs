// scripts/crew/lib/risk.mjs
import { globToRegExp } from './glob.mjs';

/**
 * 'auto' only if every changed file matches an eligiblePath AND no file matches
 * an alwaysReview pattern. Otherwise 'review'. Fail-safe: empty changeset → review.
 * @param {string[]} changedFiles
 * @param {{autoMerge:{eligiblePaths:string[],alwaysReview:string[]}}} config
 * @returns {'auto'|'review'}
 */
export function classify(changedFiles, config) {
  if (changedFiles.length === 0) return 'review';
  const eligible = config.autoMerge.eligiblePaths.map(globToRegExp);
  const review = config.autoMerge.alwaysReview.map(globToRegExp);
  const anyReview = changedFiles.some((f) => review.some((r) => r.test(f)));
  const allEligible = changedFiles.every((f) => eligible.some((r) => r.test(f)));
  return !anyReview && allEligible ? 'auto' : 'review';
}
