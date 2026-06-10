// @ts-check
// scripts/crew/lib/launch.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';

/**
 * Launch a worker for `pbiId` in `worktree` using the configured adapter, invoking
 * `onExit` when the process ends. Returns the child process.
 * @param {{workerTool: string, launchAdapters: Record<string, string>}} config
 * @param {string} worktree
 * @param {string} pbiId
 * @param {() => void} onExit
 * @returns {import('node:child_process').ChildProcess}
 */
export function launchWorker(config, worktree, pbiId, onExit) {
  const adapter = config.launchAdapters[config.workerTool];
  if (!adapter) throw new Error(`No adapter for workerTool '${config.workerTool}'`);
  const charge = join(process.cwd(), 'scripts/crew/prompts/worker.md');
  const child = spawn('bash', [adapter, worktree, pbiId, charge], { stdio: 'inherit' });
  child.on('exit', onExit);
  return child;
}
