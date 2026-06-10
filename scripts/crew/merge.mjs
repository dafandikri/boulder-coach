// @ts-check
// scripts/crew/merge.mjs
import { execFileSync } from 'node:child_process';
import { rebaseOnto, mergeFastForwardOnly, removeWorktree, currentBranch } from './lib/git.mjs';

/**
 * Land a worker branch on local `base`. NEVER pushes (repo policy). Re-runs the
 * FULL gate after rebase so a stale branch can't land a regression. Every step
 * returns a reason on failure (never throws) so the caller can re-queue rather
 * than strand the claim.
 * @param {{branch: string, worktree: string, base?: string}} opts
 * @returns {{merged: boolean, reason?: string}}
 */
export function landBranch({ branch, worktree, base = 'main' }) {
  // The ff-merge happens in the conductor's own working tree; if it isn't on
  // `base`, the merge would land on the wrong branch — refuse and let a human look.
  if (currentBranch() !== base) {
    return { merged: false, reason: `primary working tree is not on ${base}` };
  }
  try {
    rebaseOnto(base, worktree);
  } catch {
    return { merged: false, reason: 'rebase-conflict' };
  }
  try {
    execFileSync('pnpm', ['gate'], { cwd: worktree, stdio: 'inherit' });
  } catch {
    return { merged: false, reason: 'gate-failed-after-rebase' };
  }
  try {
    mergeFastForwardOnly(branch);
    removeWorktree(worktree);
  } catch (err) {
    return {
      merged: false,
      reason: `ff-merge-failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return { merged: true };
}
