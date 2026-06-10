// scripts/crew/merge.mjs
import { execFileSync } from 'node:child_process';
import { rebaseOnto, mergeFastForwardOnly, removeWorktree } from './lib/git.mjs';

/**
 * Land a worker branch on local main. NEVER pushes (repo policy). Re-runs the FULL
 * gate after rebase so a stale branch can't land a regression.
 * @param {{branch: string, worktree: string, base?: string}} opts
 * @returns {{merged: boolean, reason?: string}}
 */
export function landBranch({ branch, worktree, base = 'main' }) {
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
  mergeFastForwardOnly(branch);
  removeWorktree(worktree);
  return { merged: true };
}
