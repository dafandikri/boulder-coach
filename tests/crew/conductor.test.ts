import { describe, it, expect } from 'vitest';
import { createConductor } from '../../scripts/crew/conduct.mjs';

// Drives the conductor state machine with in-memory fakes — no real agent, git, or
// filesystem. This is the executable coverage for what was a gate-blind risk:
// "real multi-worker orchestration is unexercised". Every branch of the
// assign → launch → finish → (merge | queue) machine is asserted here.

type Claim = {
  pbiId: string;
  files: string[];
  worktree: string;
  branch: string;
  status: string;
  heartbeat: string;
  owner: string;
};
type Verdict = { verdict: 'approve' | 'flag'; reason?: string };

// Parser recognizes numeric PBI ids (BC-\d+); these are mock/test ids in that range.
const ALPHA = [
  '### BC-90 · Mock alpha — `open`',
  '- **Priority:** P1 · **Complexity:** S · **Depends on:** —',
  '- **Files:** `src/domain/a.ts`',
].join('\n');

const LARGE = [
  '### BC-91 · Mock large — `open`',
  '- **Priority:** P1 · **Complexity:** L · **Depends on:** —',
  '- **Files:** `src/domain/x.ts`, `src/domain/y.ts`',
].join('\n');

const NOW = new Date('2026-06-11T10:00:00.000Z').getTime();

function makeHarness(opts: {
  backlog: string;
  maxWorkers?: number;
  changed?: string[];
  verdict?: Verdict;
  split?: { id: string; files: string[] }[];
  landed?: { merged: boolean; reason?: string };
}) {
  const claims: Claim[] = [];
  const completed = new Set<string>();
  const log: string[] = [];
  const queued: { pbiId: string; reason: string }[] = [];
  const landedCalls: string[] = [];
  const worktrees: string[] = [];
  const installed: string[] = [];
  const exits: Array<() => void> = [];

  const deps = {
    root: '/tmp/mock-crew-repo',
    config: {
      maxWorkers: opts.maxWorkers ?? 1,
      workerTool: 'claude',
      leaseSeconds: 1800,
      launchAdapters: { claude: 'mock-adapter' },
      autoMerge: {
        eligiblePaths: ['src/domain/**'],
        alwaysReview: ['src/domain/adaptation.ts', 'scripts/**'],
      },
    },
    readBacklog: () => opts.backlog,
    readCompleted: () => [...completed],
    recordCompleted: (id: string) => {
      completed.add(id);
    },
    readClaims: () => claims,
    tryClaim: (c: Claim) => {
      if (claims.some((x) => x.pbiId === c.pbiId)) return false;
      claims.push(c);
      return true;
    },
    writeClaim: (c: Claim) => {
      const i = claims.findIndex((x) => x.pbiId === c.pbiId);
      if (i >= 0) claims[i] = c;
    },
    releaseClaim: (id: string) => {
      const i = claims.findIndex((x) => x.pbiId === id);
      if (i >= 0) claims.splice(i, 1);
    },
    addWorktree: (wt: string) => {
      worktrees.push(wt);
    },
    installDeps: (wt: string) => {
      installed.push(wt);
    },
    changedFiles: () => opts.changed ?? ['src/domain/a.ts'],
    launchWorker: (_wt: string, _id: string, onExit: () => void) => {
      exits.push(onExit);
    },
    runReviewer: (): Verdict => opts.verdict ?? { verdict: 'approve' },
    landBranch: (o: { branch: string; worktree: string }) => {
      landedCalls.push(o.branch);
      return opts.landed ?? { merged: true };
    },
    consultBrain: () => ({ split: opts.split ?? [] }),
    queueForHuman: (pbiId: string, _branch: string, reason: string) => {
      queued.push({ pbiId, reason });
    },
    log: (m: string) => {
      log.push(m);
    },
    now: () => NOW,
  };
  return { deps, claims, completed, log, queued, landedCalls, worktrees, installed, exits };
}

describe('conductor state machine (fakes)', () => {
  it('assigns the top PBI: claim, worktree, env install, launch', () => {
    const h = makeHarness({ backlog: ALPHA });
    createConductor(h.deps).tick();
    expect(h.claims.map((c) => c.pbiId)).toEqual(['BC-90']);
    expect(h.claims[0]?.status).toBe('working');
    expect(h.worktrees).toHaveLength(1);
    expect(h.installed).toHaveLength(1);
    expect(h.exits).toHaveLength(1);
  });

  it('auto-merges an eligible branch the reviewer approves, then releases the claim', () => {
    const h = makeHarness({
      backlog: ALPHA,
      changed: ['src/domain/a.ts'],
      verdict: { verdict: 'approve' },
    });
    createConductor(h.deps).tick();
    h.exits[0]?.();
    expect(h.landedCalls).toEqual(['agent/BC-90']);
    expect(h.claims).toHaveLength(0);
    expect(h.log).toContain('merged BC-90');
  });

  it('routes a non-eligible (review-tier) branch to the human queue, no merge', () => {
    const h = makeHarness({ backlog: ALPHA, changed: ['src/data/repo.ts'] });
    createConductor(h.deps).tick();
    h.exits[0]?.();
    expect(h.queued).toEqual([{ pbiId: 'BC-90', reason: 'tier=review' }]);
    expect(h.landedCalls).toHaveLength(0);
    expect(h.claims).toHaveLength(1); // still held, awaiting human
  });

  it('queues an eligible branch the reviewer flags', () => {
    const h = makeHarness({
      backlog: ALPHA,
      changed: ['src/domain/a.ts'],
      verdict: { verdict: 'flag', reason: 'mock silent failure' },
    });
    createConductor(h.deps).tick();
    h.exits[0]?.();
    expect(h.queued).toEqual([{ pbiId: 'BC-90', reason: 'mock silent failure' }]);
    expect(h.landedCalls).toHaveLength(0);
  });

  it('queues (not strands) a branch whose post-rebase merge is blocked', () => {
    const h = makeHarness({
      backlog: ALPHA,
      changed: ['src/domain/a.ts'],
      verdict: { verdict: 'approve' },
      landed: { merged: false, reason: 'gate-failed-after-rebase' },
    });
    createConductor(h.deps).tick();
    h.exits[0]?.();
    expect(h.queued).toEqual([{ pbiId: 'BC-90', reason: 'gate-failed-after-rebase' }]);
    expect(h.claims).toHaveLength(1);
  });

  it('acts on a valid manager split: assigns file-disjoint sub-tasks', () => {
    const h = makeHarness({
      backlog: LARGE,
      maxWorkers: 2,
      split: [
        { id: 'BC-91a', files: ['src/domain/x.ts'] },
        { id: 'BC-91b', files: ['src/domain/y.ts'] },
      ],
    });
    createConductor(h.deps).tick();
    expect(h.claims.map((c) => c.pbiId).sort()).toEqual(['BC-91a', 'BC-91b']);
    expect(h.log.some((l) => l.includes('split BC-91'))).toBe(true);
  });

  it('falls back to the whole PBI when a split cannot fit the free slots', () => {
    const h = makeHarness({
      backlog: LARGE,
      maxWorkers: 1, // only one slot, but the split has two units
      split: [
        { id: 'BC-91a', files: ['src/domain/x.ts'] },
        { id: 'BC-91b', files: ['src/domain/y.ts'] },
      ],
    });
    createConductor(h.deps).tick();
    // Assigns BC-91 whole (1 slot) rather than stranding a sub-task.
    expect(h.claims.map((c) => c.pbiId)).toEqual(['BC-91']);
  });

  it('does not re-assign a PBI it already merged, even if backlog still says open', () => {
    const h = makeHarness({
      backlog: ALPHA,
      changed: ['src/domain/a.ts'],
      verdict: { verdict: 'approve' },
    });
    const c = createConductor(h.deps);
    c.tick();
    h.exits[0]?.(); // BC-90 merged → recorded completed + claim released
    expect(h.claims).toHaveLength(0);
    expect(h.completed.has('BC-90')).toBe(true);
    c.tick(); // ALPHA still lists BC-90 'open', but it must not be re-assigned
    expect(h.claims).toHaveLength(0);
  });

  it('reclaims a claim whose lease has expired', () => {
    const h = makeHarness({ backlog: ALPHA });
    h.claims.push({
      pbiId: 'BC-OLD',
      files: ['mock/z.ts'],
      worktree: 'mock-wt',
      branch: 'agent/BC-OLD',
      status: 'working',
      heartbeat: '2026-06-11T09:00:00.000Z', // 1h before NOW, lease is 30m → expired
      owner: 'agent/BC-OLD',
    });
    createConductor(h.deps).reclaimExpired();
    expect(h.claims.find((c) => c.pbiId === 'BC-OLD')).toBeUndefined();
  });
});
