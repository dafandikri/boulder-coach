// @ts-check
// scripts/crew/crew.mjs
// Crew CLI: the human override surface. status / approve / reject / pause / resume / start.
import { existsSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readClaims, releaseClaim } from './lib/claims.mjs';
import { landBranch } from './merge.mjs';

const CREW = join(process.cwd(), '.crew');
/** @param {string} name */
const flag = (name) => join(CREW, name);

function status() {
  console.log('=== workers ===');
  for (const c of readClaims(CREW)) console.log(`${c.pbiId}\t${c.status}\t${c.branch}`);
  const rq = join(CREW, 'review-queue');
  console.log('\n=== review queue ===');
  if (existsSync(rq)) {
    for (const f of readdirSync(rq)) console.log(f.replace('.md', ''));
  }
  console.log(`\npaused: ${String(existsSync(flag('PAUSED')))}`);
}

/** @param {string} pbiId */
function approve(pbiId) {
  const c = readClaims(CREW).find((x) => x.pbiId === pbiId);
  if (!c) throw new Error(`no claim ${pbiId}`);
  const res = landBranch({ branch: c.branch, worktree: c.worktree });
  if (!res.merged) throw new Error(`merge blocked: ${res.reason ?? ''}`);
  releaseClaim(CREW, pbiId);
  rmSync(join(CREW, 'review-queue', `${pbiId}.md`), { force: true });
  console.log(`merged ${pbiId}`);
}

/** @param {string} pbiId */
function reject(pbiId) {
  const c = readClaims(CREW).find((x) => x.pbiId === pbiId);
  if (c) execFileSync('git', ['worktree', 'remove', '--force', c.worktree]);
  releaseClaim(CREW, pbiId);
  rmSync(join(CREW, 'review-queue', `${pbiId}.md`), { force: true });
  console.log(`rejected ${pbiId} (worktree + claim removed)`);
}

const USAGE = 'usage: crew <status|approve PBI|reject PBI|pause|resume|start>';

/**
 * Run one CLI command. Returns true if the command was recognized.
 * @param {string[]} argv argv after the node + script (i.e. process.argv.slice(2))
 * @returns {boolean}
 */
export function run(argv) {
  const [cmd, arg] = argv;
  switch (cmd) {
    case 'status':
      status();
      return true;
    case 'approve':
      if (!arg) throw new Error('approve requires a PBI id');
      approve(arg);
      return true;
    case 'reject':
      if (!arg) throw new Error('reject requires a PBI id');
      reject(arg);
      return true;
    case 'pause':
      writeFileSync(flag('PAUSED'), '');
      console.log('paused');
      return true;
    case 'resume':
      rmSync(flag('PAUSED'), { force: true });
      console.log('resumed');
      return true;
    case 'start':
      execFileSync('node', ['scripts/crew/conduct.mjs'], { stdio: 'inherit' });
      return true;
    default:
      console.log(USAGE);
      return false;
  }
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) run(process.argv.slice(2));
