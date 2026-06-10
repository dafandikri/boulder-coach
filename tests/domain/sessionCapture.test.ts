import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DexieClimbRepo } from '../../src/data/dexieRepo';
import { expandTally } from '../../src/app/lib/sessionForm';
import { createSessionLog } from '../../src/domain/sessionLog';
import { computeInsights } from '../../src/domain/insights';

// End-to-end BC-04: the session player tallies grades as {grade: count}, expands
// them to the log's flat arrays, persists via the repo, and the Insights pyramid
// must then reflect those sends. Catches any break in that wiring (not just the
// pure pyramid math, which insights.test.ts already covers).
describe('session capture → insights pyramid (BC-04)', () => {
  it('a logged session with sends shows up in the grade pyramid', async () => {
    const repo = new DexieClimbRepo(`capture-${Math.random()}`);

    // UI state: attempted V5 twice + V6 once; sent V5 twice, V6 once.
    const attempts = expandTally({ 5: 2, 6: 1 });
    const sends = expandTally({ 5: 2, 6: 1 });

    const log = createSessionLog({
      date: '2026-06-10',
      plannedSessionId: 'mock-session',
      warmupCompleted: true,
      blocks: [
        {
          blockId: 'main-limit',
          setsCompleted: 5,
          gradesAttempted: attempts,
          gradesSent: sends,
          rpe: 8,
        },
      ],
      durationMin: 75,
    });
    await repo.saveLog(log);

    const insights = computeInsights(await repo.getLogs(), await repo.getCheckIns());
    const pyramid = Object.fromEntries(insights.gradePyramid.map((e) => [e.grade, e.count]));

    expect(pyramid[5]).toBe(2);
    expect(pyramid[6]).toBe(1);
  });

  it('a session logged with no sends leaves the pyramid empty', async () => {
    const repo = new DexieClimbRepo(`capture-empty-${Math.random()}`);
    const log = createSessionLog({
      date: '2026-06-10',
      plannedSessionId: 'mock-session',
      warmupCompleted: true,
      blocks: [
        {
          blockId: 'main-limit',
          setsCompleted: 4,
          gradesAttempted: expandTally({ 5: 3 }),
          gradesSent: expandTally({}),
          rpe: 9,
        },
      ],
      durationMin: 60,
    });
    await repo.saveLog(log);

    const insights = computeInsights(await repo.getLogs(), await repo.getCheckIns());
    expect(insights.gradePyramid).toHaveLength(0);
  });
});
