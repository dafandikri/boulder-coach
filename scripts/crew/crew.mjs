// scripts/crew/crew.mjs
// Crew CLI: human override surface. status / approve / reject / pause / resume / start.
import { existsSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readClaims, releaseClaim } from './lib/claims.mjs';
import { landBranch } from './merge.mjs';

const CREW = join(process.cwd(), '.crew');
const [cmd, arg] = process.argv.slice(2);
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

switch (cmd) {
  case 'status':
    status();
    break;
  case 'approve':
    approve(arg);
    break;
  case 'reject':
    reject(arg);
    break;
  case 'pause':
    writeFileSync(flag('PAUSED'), '');
    console.log('paused');
    break;
  case 'resume':
    rmSync(flag('PAUSED'), { force: true });
    console.log('resumed');
    break;
  case 'start':
    execFileSync('node', ['scripts/crew/conduct.mjs'], { stdio: 'inherit' });
    break;
  default:
    console.log('usage: crew <status|approve PBI|reject PBI|pause|resume|start>');
}
