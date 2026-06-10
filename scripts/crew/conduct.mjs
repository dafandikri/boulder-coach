// @ts-check
// scripts/crew/conduct.mjs
// The Crew conductor: a deterministic loop that owns all correctness guarantees
// (atomic claims, file-disjoint locking, dependency gating, serial rebase→gate→
// merge). LLM roles it calls (manager brain, reviewer) are fail-safe. The decision
// logic lives in `createConductor`, which takes injected dependencies so the whole
// state machine is unit-testable without launching a real agent or touching git.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseBacklog } from './lib/backlog.mjs';
import { nextAssignable } from './lib/schedule.mjs';
import { planAssignments } from './lib/split.mjs';
import { decideAction } from './lib/route.mjs';
import { classify } from './lib/risk.mjs';
import { isExpired } from './lib/lease.mjs';
import { shouldConsultBrain, consultBrain } from './lib/manager.mjs';
import {
  readClaims,
  tryClaim,
  writeClaim,
  releaseClaim,
  readCompleted,
  recordCompleted,
} from './lib/claims.mjs';
import { addWorktree, changedFiles } from './lib/git.mjs';
import { launchWorker } from './lib/launch.mjs';
import { runReviewer } from './lib/review.mjs';
import { landBranch } from './merge.mjs';

/** @typedef {import('./lib/claims.mjs').Claim} Claim */
/** @typedef {import('./lib/route.mjs').Verdict} Verdict */
/**
 * @typedef {Object} CrewConfig
 * @property {number} maxWorkers
 * @property {string} workerTool
 * @property {number} leaseSeconds
 * @property {Record<string, string>} launchAdapters
 * @property {string[]} [aiAgent] one-shot agent argv for reviewer/manager (default: claude --print)
 * @property {{eligiblePaths: string[], alwaysReview: string[]}} autoMerge
 */
/**
 * @typedef {Object} ConductorDeps
 * @property {string} root
 * @property {CrewConfig} config
 * @property {() => string} readBacklog
 * @property {() => string[]} readCompleted ids the conductor has already merged
 * @property {(pbiId: string) => void} recordCompleted
 * @property {() => Claim[]} readClaims
 * @property {(claim: Claim) => boolean} tryClaim
 * @property {(claim: Claim) => void} writeClaim
 * @property {(pbiId: string) => void} releaseClaim
 * @property {(worktree: string, branch: string, base: string) => void} addWorktree
 * @property {(worktree: string) => void} installDeps
 * @property {(branch: string) => string[]} changedFiles
 * @property {(worktree: string, pbiId: string, onExit: () => void) => void} launchWorker
 * @property {(branch: string, pbiId: string) => Verdict} runReviewer
 * @property {(opts: {branch: string, worktree: string}) => {merged: boolean, reason?: string}} landBranch
 * @property {(pbi: import('./lib/backlog.mjs').Pbi) => {split: {id: string, files: string[]}[]}} consultBrain
 * @property {(pbiId: string, branch: string, reason: string) => void} queueForHuman
 * @property {(msg: string) => void} log
 * @property {() => number} now
 */

/**
 * Build a conductor from injected dependencies. Returns the state-machine
 * operations; the caller owns the polling cadence.
 * @param {ConductorDeps} deps
 */
export function createConductor(deps) {
  const { config } = deps;

  /** Release claims whose worker has gone silent past the lease window. */
  function reclaimExpired() {
    const now = deps.now();
    for (const c of deps.readClaims()) {
      if (c.status === 'working' && isExpired(c, now, config.leaseSeconds)) {
        deps.log(`reclaim ${c.pbiId} (lease expired)`);
        deps.releaseClaim(c.pbiId);
      }
    }
  }

  /** @returns {import('./lib/schedule.mjs').ActiveClaim[]} */
  function activeClaims() {
    return deps.readClaims().map((c) => ({ pbiId: c.pbiId, files: c.files }));
  }

  /**
   * Assign the next safely-schedulable PBI (possibly as manager-split sub-tasks)
   * across the free worker slots. Returns true if at least one unit was assigned.
   * @returns {boolean}
   */
  function assignOne() {
    const active = activeClaims();
    const slots = config.maxWorkers - active.length;
    if (slots <= 0) return false;
    // Exclude PBIs the conductor already merged (its own record of done), so a
    // worker that forgot to mark BACKLOG status can't cause a re-assignment loop.
    const completed = new Set(deps.readCompleted());
    const pbis = parseBacklog(deps.readBacklog()).filter((p) => !completed.has(p.id));
    const pbi = nextAssignable(pbis, active);
    if (!pbi) return false;

    const split = shouldConsultBrain(pbi) ? deps.consultBrain(pbi).split : [];
    let units = planAssignments(pbi, split, active);
    // If a split can't fit the free slots, assigning a subset would strand the
    // rest (their files stay locked under the parent). Take the whole PBI instead.
    if (split.length > 0 && units.length > slots) {
      const whole = planAssignments(pbi, [], active);
      if (whole.length > 0) units = whole;
    }
    if (units.length === 0) return false;
    if (units.length > 1) deps.log(`split ${pbi.id} → ${units.map((u) => u.id).join(', ')}`);

    let assigned = false;
    for (const unit of units.slice(0, slots)) {
      if (assignUnit(unit)) assigned = true;
    }
    return assigned;
  }

  /**
   * @param {{id: string, files: string[]}} unit
   * @returns {boolean}
   */
  function assignUnit(unit) {
    const branch = `agent/${unit.id}`;
    const worktree = join(deps.root, '..', `boulder-coach-${unit.id}`);
    /** @type {Claim} */
    const claim = {
      pbiId: unit.id,
      files: unit.files,
      worktree,
      branch,
      status: 'claimed',
      heartbeat: new Date(deps.now()).toISOString(),
      owner: branch,
    };
    if (!deps.tryClaim(claim)) return false;
    deps.addWorktree(worktree, branch, 'main');
    deps.installDeps(worktree); // guarantee a working env before the worker starts (spec §7)
    deps.writeClaim({ ...claim, status: 'working', heartbeat: new Date(deps.now()).toISOString() });
    deps.log(`assign ${unit.id} → ${worktree}`);
    deps.launchWorker(worktree, unit.id, () => {
      finishWorker(unit.id, branch, worktree);
    });
    return true;
  }

  /**
   * Route a finished worker's branch: reviewer-gated auto-merge, else human queue.
   * A blocked merge (rebase conflict / gate fail after rebase) also goes to the queue
   * rather than silently stranding the claim.
   * @param {string} pbiId @param {string} branch @param {string} worktree
   */
  function finishWorker(pbiId, branch, worktree) {
    const files = deps.changedFiles(branch);
    const tier = classify(files, config);
    const verdict = tier === 'auto' ? deps.runReviewer(branch, pbiId) : null;
    const action = decideAction(tier, verdict);
    if (action.action === 'merge') {
      const res = deps.landBranch({ branch, worktree });
      if (res.merged) {
        deps.log(`merged ${pbiId}`);
        deps.recordCompleted(pbiId);
        deps.releaseClaim(pbiId);
      } else {
        deps.log(`merge-blocked ${pbiId}: ${res.reason ?? ''}`);
        deps.queueForHuman(pbiId, branch, res.reason ?? 'merge blocked');
      }
      return;
    }
    deps.queueForHuman(pbiId, branch, action.reason ?? 'review');
  }

  /** One scheduling pass: reclaim expired leases, then fill every free slot. */
  function tick() {
    reclaimExpired();
    while (assignOne()) {
      /* keep filling slots until none remain or nothing is assignable */
    }
  }

  return { reclaimExpired, assignOne, finishWorker, tick };
}

// ───────────────────────── real-dependency wiring (entrypoint only) ──────────

/**
 * @param {string} crew
 * @returns {CrewConfig}
 */
function readConfig(crew) {
  return /** @type {CrewConfig} */ (JSON.parse(readFileSync(join(crew, 'config.json'), 'utf8')));
}

/**
 * @param {string} crew @param {string} msg
 */
function appendLog(crew, msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  if (!existsSync(crew)) mkdirSync(crew, { recursive: true });
  writeFileSync(join(crew, 'log.md'), line, { flag: 'a' });
  process.stdout.write(line);
}

/**
 * @param {string} crew @param {string} pbiId @param {string} branch @param {string} reason
 */
function writeReviewQueue(crew, pbiId, branch, reason) {
  const dir = join(crew, 'review-queue');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${pbiId}.md`),
    `# ${pbiId} on ${branch}\n\nReason: ${reason}\n\n` +
      `Review: \`git diff main...${branch}\`\n` +
      `Approve: \`pnpm crew approve ${pbiId}\`\n`,
  );
  appendLog(crew, `review-queue ${pbiId}: ${reason}`);
}

/** @returns {ConductorDeps} */
function realDeps() {
  const root = process.cwd();
  const crew = join(root, '.crew');
  const config = readConfig(crew);
  return {
    root,
    config,
    readBacklog: () => readFileSync(join(root, 'docs/BACKLOG.md'), 'utf8'),
    readCompleted: () => readCompleted(crew),
    recordCompleted: (id) => {
      recordCompleted(crew, id);
    },
    readClaims: () => readClaims(crew),
    tryClaim: (c) => tryClaim(crew, c),
    writeClaim: (c) => {
      writeClaim(crew, c);
    },
    releaseClaim: (id) => {
      releaseClaim(crew, id);
    },
    addWorktree: (wt, br, base) => {
      addWorktree(wt, br, base);
    },
    installDeps: (wt) => {
      execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: wt, stdio: 'inherit' });
    },
    changedFiles: (br) => changedFiles(br),
    launchWorker: (wt, id, onExit) => {
      launchWorker(config, wt, id, onExit);
    },
    runReviewer: (br, id) => runReviewer(br, id, config.aiAgent),
    landBranch: (o) => landBranch(o),
    consultBrain: (pbi) => consultBrain(pbi, config.aiAgent),
    queueForHuman: (id, br, reason) => {
      writeReviewQueue(crew, id, br, reason);
    },
    log: (msg) => {
      appendLog(crew, msg);
    },
    now: () => Date.now(),
  };
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const deps = realDeps();
  const conductor = createConductor(deps);
  const paused = () => existsSync(join(deps.root, '.crew', 'PAUSED'));
  deps.log('conductor start');
  const run = async () => {
    for (;;) {
      if (!paused()) conductor.tick();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  };
  void run();
}
