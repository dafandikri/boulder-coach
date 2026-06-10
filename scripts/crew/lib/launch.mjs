// scripts/crew/lib/launch.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';

/**
 * Launch a worker for `pbiId` in `worktree` using the configured adapter.
 * Returns the child process; the caller tracks completion via claim status/heartbeat.
 * @param {{workerTool: string, launchAdapters: Record<string, string>}} config
 * @param {string} worktree
 * @param {string} pbiId
 * @returns {import('node:child_process').ChildProcess}
 */
export function launchWorker(config, worktree, pbiId) {
  const adapter = config.launchAdapters[config.workerTool];
  if (!adapter) throw new Error(`No adapter for workerTool '${config.workerTool}'`);
  const charge = join(process.cwd(), 'scripts/crew/prompts/worker.md');
  return spawn('bash', [adapter, worktree, pbiId, charge], { stdio: 'inherit' });
}
