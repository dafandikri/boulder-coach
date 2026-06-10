// @ts-check
// scripts/crew/lib/git.mjs
import { execFileSync } from 'node:child_process';

/**
 * @param {string[]} args
 * @param {{cwd?: string}} [opts]
 * @returns {string}
 */
const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();

/** @param {string} [cwd] @returns {string} */
export function currentBranch(cwd = process.cwd()) {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
}

/**
 * Create a worktree at `path` on a new `branch` from `base`.
 * @param {string} path @param {string} branch @param {string} [base]
 */
export function addWorktree(path, branch, base = 'main') {
  git(['worktree', 'add', '-b', branch, path, base]);
}

/** @param {string} path */
export function removeWorktree(path) {
  git(['worktree', 'remove', '--force', path]);
}

/**
 * Files changed on `branch` relative to `base`.
 * @param {string} branch @param {string} [base] @param {string} [cwd]
 * @returns {string[]}
 */
export function changedFiles(branch, base = 'main', cwd = process.cwd()) {
  const out = git(['diff', '--name-only', `${base}...${branch}`], { cwd });
  return out ? out.split('\n').filter(Boolean) : [];
}

/**
 * Rebase the current worktree's branch onto `base`; throws on conflict.
 * @param {string} base @param {string} cwd
 */
export function rebaseOnto(base, cwd) {
  git(['rebase', base], { cwd });
}

/** @param {string} branch */
export function mergeFastForwardOnly(branch) {
  git(['merge', '--ff-only', branch]);
}
