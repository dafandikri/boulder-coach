// scripts/crew/conduct.mjs
// The Crew conductor: a deterministic polling loop that owns all correctness
// guarantees (atomic claims, file-disjoint locking, dependency gating, serial
// rebase→gate→merge). The LLM roles it calls (manager brain, reviewer) are
// fail-safe: if they error, the deterministic path still works.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseBacklog } from './lib/backlog.mjs';
import { nextAssignable } from './lib/schedule.mjs';
import { readClaims, tryClaim, writeClaim, releaseClaim } from './lib/claims.mjs';
import { isExpired } from './lib/lease.mjs';
import { addWorktree, changedFiles } from './lib/git.mjs';
import { launchWorker } from './lib/launch.mjs';
import { classify } from './lib/risk.mjs';
import { runReviewer } from './lib/review.mjs';
import { consultBrain, shouldConsultBrain } from './lib/manager.mjs';
import { landBranch } from './merge.mjs';

const ROOT = process.cwd();
const CREW = join(ROOT, '.crew');
const config = JSON.parse(readFileSync(join(CREW, 'config.json'), 'utf8'));
const PAUSED = () => existsSync(join(CREW, 'PAUSED'));

/** @param {string} msg */
const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}\n`;
  if (!existsSync(CREW)) mkdirSync(CREW, { recursive: true });
  writeFileSync(join(CREW, 'log.md'), line, { flag: 'a' });
  process.stdout.write(line);
};

function reclaimExpired() {
  const now = Date.now();
  for (const c of readClaims(CREW)) {
    if (c.status === 'working' && isExpired(c, now, config.leaseSeconds)) {
      log(`reclaim ${c.pbiId} (lease expired)`);
      releaseClaim(CREW, c.pbiId);
    }
  }
}

/** @returns {boolean} true if a PBI was assigned */
function assignOne() {
  const pbis = parseBacklog(readFileSync(join(ROOT, 'docs/BACKLOG.md'), 'utf8'));
  const active = readClaims(CREW).map((c) => ({ pbiId: c.pbiId, files: c.files }));
  if (active.length >= config.maxWorkers) return false;
  const pbi = nextAssignable(pbis, active);
  if (!pbi) return false;

  // Adaptive manager brain (optional): surface a split recommendation for big PBIs.
  // The deterministic path proceeds regardless — splitting-into-subtasks is a follow-up.
  if (shouldConsultBrain(pbi)) {
    const plan = consultBrain(pbi);
    if (plan.split.length > 0) {
      log(`manager suggests splitting ${pbi.id} into ${plan.split.map((s) => s.id).join(', ')}`);
    }
  }

  const branch = `agent/${pbi.id}`;
  const worktree = join(ROOT, '..', `boulder-coach-${pbi.id}`);
  const heartbeat = new Date().toISOString();
  if (
    !tryClaim(CREW, {
      pbiId: pbi.id,
      files: pbi.files,
      worktree,
      branch,
      status: 'claimed',
      heartbeat,
      owner: branch,
    })
  ) {
    return false;
  }
  addWorktree(worktree, branch, 'main');
  // Guarantee a working environment before the worker starts (spec §7).
  execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: worktree, stdio: 'inherit' });
  log(`assign ${pbi.id} → ${worktree}`);
  const claim = readClaims(CREW).find((c) => c.pbiId === pbi.id);
  if (claim) writeClaim(CREW, { ...claim, status: 'working', heartbeat: new Date().toISOString() });
  const child = launchWorker(config, worktree, pbi.id);
  child.on('exit', () => {
    finishWorker(pbi.id, branch, worktree);
  });
  return true;
}

/** @param {string} pbiId @param {string} branch @param {string} worktree */
function finishWorker(pbiId, branch, worktree) {
  const files = changedFiles(branch);
  const tier = classify(files, config);
  if (tier === 'auto') {
    const verdict = runReviewer(branch, pbiId);
    if (verdict.verdict === 'approve') {
      const res = landBranch({ branch, worktree });
      log(res.merged ? `merged ${pbiId}` : `merge-blocked ${pbiId}: ${res.reason ?? ''}`);
      if (res.merged) releaseClaim(CREW, pbiId);
      return;
    }
    queueForHuman(pbiId, branch, verdict.reason ?? 'flagged');
    return;
  }
  queueForHuman(pbiId, branch, `tier=review (${files.length} files)`);
}

/** @param {string} pbiId @param {string} branch @param {string} reason */
function queueForHuman(pbiId, branch, reason) {
  const dir = join(CREW, 'review-queue');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${pbiId}.md`),
    `# ${pbiId} on ${branch}\n\nReason: ${reason}\n\n` +
      `Review: \`git diff main...${branch}\`\n` +
      `Approve: \`pnpm crew approve ${pbiId}\`\n`,
  );
  log(`review-queue ${pbiId}: ${reason}`);
}

async function loop() {
  log('conductor start');
  for (;;) {
    if (!PAUSED()) {
      reclaimExpired();
      while (assignOne()) {
        /* fill open worker slots */
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

loop();
