import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DexieClimbRepo } from '../../src/data/dexieRepo';
import {
  getTodaySession,
  loadAdaptationLog,
  sortAdaptationLogNewestFirst,
  levelUpProfile,
  DEFAULT_PROFILE,
} from '../../src/app/lib/bootstrap';
import type { AdaptationLogEntry, CheckIn } from '../../src/domain/types';

describe('getTodaySession', () => {
  it('creates a profile + program on first run and returns an adapted session', async () => {
    const repo = new DexieClimbRepo(`boot-${Math.random()}`);
    const result = await getTodaySession(repo, new Date('2026-06-09'));

    expect(await repo.getProfile()).toEqual(DEFAULT_PROFILE);
    expect(await repo.getActiveProgram()).toBeDefined();
    expect(result.session.blocks.length).toBeGreaterThan(0);
    expect(Array.isArray(result.changes)).toBe(true);
  });

  it('reuses the existing program on subsequent runs', async () => {
    const repo = new DexieClimbRepo(`boot-${Math.random()}`);
    await getTodaySession(repo, new Date('2026-06-09'));
    const firstProgram = await repo.getActiveProgram();
    await getTodaySession(repo, new Date('2026-06-10'));
    const secondProgram = await repo.getActiveProgram();
    expect(secondProgram?.id).toBe(firstProgram?.id);
  });

  it('advances to the derived week as time passes (BC-01)', async () => {
    const repo = new DexieClimbRepo(`boot-week-${Math.random()}`);
    await getTodaySession(repo, new Date('2026-06-01T08:00:00')); // program starts day 0
    const later = await getTodaySession(repo, new Date('2026-06-16T08:00:00')); // start + 15 days
    expect(later.session.weekIndex).toBe(2); // week index 2 — a deload week
  });

  it('rolls into a fresh cycle once the 6-week mesocycle completes (BC-01)', async () => {
    const repo = new DexieClimbRepo(`boot-roll-${Math.random()}`);
    await getTodaySession(repo, new Date('2026-06-01T08:00:00'));
    const firstProgram = await repo.getActiveProgram();
    const rolled = await getTodaySession(repo, new Date('2026-07-13T08:00:00')); // start + 42 days
    const secondProgram = await repo.getActiveProgram();
    expect(secondProgram?.id).not.toBe(firstProgram?.id); // new mesocycle persisted
    expect(rolled.session.weekIndex).toBe(0); // back to week 0 of the new cycle
  });

  it('drives a full week: training on availableWeekdays, rest otherwise (BC-03)', async () => {
    const repo = new DexieClimbRepo(`boot-rest-${Math.random()}`);
    // Default profile trains Mon/Wed/Fri; program starts Mon 2026-06-01.
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 5, 1 + i, 8); // 08:00 local, Mon..Sun of week 0
      const r = await getTodaySession(repo, d);
      if ([1, 3, 5].includes(d.getDay())) {
        expect(r.session.type).not.toBe('rest');
      } else {
        expect(r.session.type).toBe('rest');
        expect(r.changes).toHaveLength(0); // rest day carries no adaptation noise
      }
    }
  });

  it('returns null readiness on a neutral-assumed day, never a fake green (BC-28)', async () => {
    const repo = new DexieClimbRepo(`boot-ready-neutral-${Math.random()}`);
    const r = await getTodaySession(repo, new Date(2026, 5, 1, 8)); // Mon, training, no check-in
    expect(r.neutralAssumed).toBe(true);
    expect(r.readiness).toBeNull();
    expect(r.consistency.weekTarget).toBe(DEFAULT_PROFILE.sessionsPerWeek);
  });

  it('computes a readiness read-out when a real check-in exists (BC-28)', async () => {
    const repo = new DexieClimbRepo(`boot-ready-real-${Math.random()}`);
    await getTodaySession(repo, new Date(2026, 5, 1, 8)); // seed program
    await repo.saveCheckIn({
      date: '2026-06-01',
      sleepQuality: 5,
      overallFatigue: 1,
      soreness: {},
      pain: {},
      motivation: 5,
    });
    const r = await getTodaySession(repo, new Date(2026, 5, 1, 8));
    expect(r.readiness).not.toBeNull();
    expect(r.readiness!.band).toBe('green');
    expect(r.readiness!.drivers.length).toBeGreaterThan(0);
  });

  it('surfaces a level-up benchmark from recent sends above current grade (BC-27)', async () => {
    const repo = new DexieClimbRepo(`boot-assess-${Math.random()}`);
    const day = new Date(2026, 5, 1, 8);
    await getTodaySession(repo, day); // seed program; DEFAULT_PROFILE is V5
    // Two distinct sessions sending V6 → measured V6, above the V5 baseline.
    for (const date of ['2026-05-28', '2026-05-30']) {
      await repo.saveLog({
        id: `mock-assess-${date}`,
        date,
        warmupCompleted: true,
        blocks: [
          { blockId: 'mock', setsCompleted: 1, gradesAttempted: [6], gradesSent: [6], rpe: 7 },
        ],
        sessionRPE: 7,
        durationMin: 60,
      });
    }
    const r = await getTodaySession(repo, day);
    expect(r.assessment.measuredGrade).toBe(6);
    expect(r.assessment.leveledUp).toBe(true);
  });

  it('surfaces the EWMA ACWR on TodayResult for the explainer (training and rest)', async () => {
    const repo = new DexieClimbRepo(`boot-acwr-${Math.random()}`);
    const day = new Date(2026, 5, 1, 8); // Mon — training day
    await getTodaySession(repo, day); // seed program
    await repo.saveLog({
      id: 'mock-acwr-log',
      date: '2026-06-01',
      warmupCompleted: true,
      blocks: [],
      sessionRPE: 8,
      durationMin: 60,
    });
    const training = await getTodaySession(repo, day);
    // One in-window session → seeded EWMA → ACWR exactly 1.0 (no cold-start spike).
    expect(training.acwr).toBe(1);
    // Rest day (Sun) still reports the load ratio for the explainer.
    const rest = await getTodaySession(repo, new Date(2026, 5, 7, 8));
    expect(typeof rest.acwr).toBe('number');
  });

  it('reports no level-up when there are no qualifying sends (BC-27)', async () => {
    const repo = new DexieClimbRepo(`boot-assess-cold-${Math.random()}`);
    const r = await getTodaySession(repo, new Date(2026, 5, 1, 8));
    expect(r.assessment.measuredGrade).toBeNull();
    expect(r.assessment.leveledUp).toBe(false);
  });

  it('reports null readiness but real consistency on a rest day (BC-28/BC-40)', async () => {
    const repo = new DexieClimbRepo(`boot-rest-ready-${Math.random()}`);
    await getTodaySession(repo, new Date(2026, 5, 1, 8)); // seed
    const rest = await getTodaySession(repo, new Date(2026, 5, 2, 8)); // Tue = rest
    expect(rest.session.type).toBe('rest');
    expect(rest.readiness).toBeNull();
    expect(rest.consistency.weekTarget).toBe(DEFAULT_PROFILE.sessionsPerWeek);
  });

  it('flags neutral when no check-in exists for the day (BC-07)', async () => {
    const repo = new DexieClimbRepo(`boot-neutral-${Math.random()}`);
    const r = await getTodaySession(repo, new Date(2026, 5, 1, 8)); // Mon, training day
    expect(r.session.type).not.toBe('rest');
    expect(r.neutralAssumed).toBe(true);
  });

  it('does not flag neutral when a check-in exists for the day (BC-07)', async () => {
    const repo = new DexieClimbRepo(`boot-checkin-${Math.random()}`);
    // seed program first so the date matches a training day
    await getTodaySession(repo, new Date(2026, 5, 1, 8));
    const checkIn: CheckIn = {
      date: '2026-06-01',
      sleepQuality: 4,
      overallFatigue: 2,
      soreness: {},
      pain: {},
      motivation: 4,
    };
    await repo.saveCheckIn(checkIn);
    const r = await getTodaySession(repo, new Date(2026, 5, 1, 8));
    expect(r.neutralAssumed).toBe(false);
  });

  it('persists one adaptation-log entry per training day, idempotently (BC-07)', async () => {
    const repo = new DexieClimbRepo(`boot-log-${Math.random()}`);
    const day = new Date(2026, 5, 1, 8); // Mon, training day
    await getTodaySession(repo, day);
    await getTodaySession(repo, day); // re-render same day must not duplicate
    const log = await repo.getAdaptationLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.date).toBe('2026-06-01');
    expect(log[0]!.neutralAssumed).toBe(true);
  });

  it('does not persist a log entry on a rest day (BC-07)', async () => {
    const repo = new DexieClimbRepo(`boot-rest-log-${Math.random()}`);
    await getTodaySession(repo, new Date(2026, 5, 2, 8)); // Tue, rest day
    expect(await repo.getAdaptationLog()).toHaveLength(0);
  });

  it('loadAdaptationLog returns the persisted log newest-first (BC-07)', async () => {
    const repo = new DexieClimbRepo(`boot-load-${Math.random()}`);
    await getTodaySession(repo, new Date(2026, 5, 1, 8)); // Mon
    await getTodaySession(repo, new Date(2026, 5, 3, 8)); // Wed
    const log = await loadAdaptationLog(repo);
    expect(log.map((e) => e.date)).toEqual(['2026-06-03', '2026-06-01']);
  });
});

describe('levelUpProfile (BC-27)', () => {
  it('raises currentGrade to the measured grade', () => {
    const base = { ...DEFAULT_PROFILE, currentGrade: 5, goalGrade: 7 };
    expect(levelUpProfile(base, 6).currentGrade).toBe(6);
  });

  it('keeps goalGrade when it already exceeds the measured grade', () => {
    const base = { ...DEFAULT_PROFILE, currentGrade: 5, goalGrade: 7 };
    expect(levelUpProfile(base, 6).goalGrade).toBe(7);
  });

  it('lifts goalGrade so it never sits below the new current grade', () => {
    const base = { ...DEFAULT_PROFILE, currentGrade: 5, goalGrade: 6 };
    expect(levelUpProfile(base, 8).goalGrade).toBe(8);
  });

  it('leaves the rest of the profile untouched', () => {
    const base = { ...DEFAULT_PROFILE, currentGrade: 5, goalGrade: 7, sessionsPerWeek: 4 };
    const next = levelUpProfile(base, 6);
    expect(next.sessionsPerWeek).toBe(4);
    expect(next.availableWeekdays).toEqual(base.availableWeekdays);
  });
});

describe('sortAdaptationLogNewestFirst', () => {
  it('orders entries by date descending without mutating the input (BC-07)', () => {
    const entries: AdaptationLogEntry[] = [
      { date: '2026-06-01', changes: [], neutralAssumed: true },
      { date: '2026-06-10', changes: [], neutralAssumed: false },
      { date: '2026-06-05', changes: [], neutralAssumed: true },
    ];
    const sorted = sortAdaptationLogNewestFirst(entries);
    expect(sorted.map((e) => e.date)).toEqual(['2026-06-10', '2026-06-05', '2026-06-01']);
    // input untouched
    expect(entries.map((e) => e.date)).toEqual(['2026-06-01', '2026-06-10', '2026-06-05']);
  });
});
