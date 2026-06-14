import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import { DexieClimbRepo } from '../../src/data/dexieRepo';
import type { CheckIn, Program, SessionLog, UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5,
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
};

describe('DexieClimbRepo', () => {
  let repo: DexieClimbRepo;

  beforeEach(() => {
    repo = new DexieClimbRepo(`test-db-${Math.random()}`);
  });

  it('round-trips the profile', async () => {
    expect(await repo.getProfile()).toBeUndefined();
    await repo.saveProfile(profile);
    expect(await repo.getProfile()).toEqual(profile);
  });

  it('overwrites profile on re-save (single profile)', async () => {
    await repo.saveProfile(profile);
    await repo.saveProfile({ ...profile, currentGrade: 6 });
    expect((await repo.getProfile())?.currentGrade).toBe(6);
  });

  it('round-trips the active program and keeps a single active one', async () => {
    expect(await repo.getActiveProgram()).toBeUndefined();
    const program: Program = {
      id: 'prog-test-1',
      startDate: '2026-06-09',
      lengthWeeks: 6,
      weeks: [],
    };
    await repo.saveProgram(program);
    expect((await repo.getActiveProgram())?.id).toBe('prog-test-1');
    // saving a second program deactivates the first
    await repo.saveProgram({ ...program, id: 'prog-test-2' });
    expect((await repo.getActiveProgram())?.id).toBe('prog-test-2');
  });

  it('returns all check-ins sorted by date', async () => {
    await repo.saveCheckIn({
      date: '2026-06-11',
      sleepQuality: 3,
      overallFatigue: 3,
      soreness: {},
      pain: {},
      motivation: 3,
    });
    await repo.saveCheckIn({
      date: '2026-06-09',
      sleepQuality: 4,
      overallFatigue: 2,
      soreness: {},
      pain: {},
      motivation: 4,
    });
    const all = await repo.getCheckIns();
    expect(all).toHaveLength(2);
    expect(all[0]!.date).toBe('2026-06-09');
    expect(all[1]!.date).toBe('2026-06-11');
  });

  it('round-trips a check-in by date', async () => {
    const checkIn: CheckIn = {
      date: '2026-06-09',
      sleepQuality: 4,
      overallFatigue: 2,
      soreness: {},
      pain: {},
      motivation: 4,
    };
    expect(await repo.getCheckIn('2026-06-09')).toBeUndefined();
    await repo.saveCheckIn(checkIn);
    expect((await repo.getCheckIn('2026-06-09'))?.sleepQuality).toBe(4);
  });

  it('accumulates logs', async () => {
    await repo.saveLog({
      id: 'l1',
      date: '2026-06-09',
      warmupCompleted: true,
      blocks: [],
      sessionRPE: 8,
      durationMin: 60,
    });
    await repo.saveLog({
      id: 'l2',
      date: '2026-06-11',
      warmupCompleted: true,
      blocks: [],
      sessionRPE: 7,
      durationMin: 50,
    });
    expect(await repo.getLogs()).toHaveLength(2);
  });

  it('round-trips adaptation-log entries and overwrites per date (BC-07)', async () => {
    expect(await repo.getAdaptationLog()).toHaveLength(0);
    await repo.saveAdaptationLogEntry({
      date: '2026-06-09',
      changes: [{ ruleId: 'test-rule', reason: 'mock reason' }],
      neutralAssumed: true,
    });
    await repo.saveAdaptationLogEntry({
      date: '2026-06-11',
      changes: [],
      neutralAssumed: false,
    });
    expect(await repo.getAdaptationLog()).toHaveLength(2);

    // re-saving the same date overwrites (idempotent per local date)
    await repo.saveAdaptationLogEntry({
      date: '2026-06-09',
      changes: [],
      neutralAssumed: false,
    });
    const log = await repo.getAdaptationLog();
    expect(log).toHaveLength(2);
    const entry = log.find((e) => e.date === '2026-06-09');
    expect(entry?.neutralAssumed).toBe(false);
    expect(entry?.changes).toHaveLength(0);
  });
});

describe('schema migration (BC-32)', () => {
  it('preserves version(1) rows when the DB is opened at version(2)', async () => {
    const name = `test-migrate-${Math.random()}`;

    // Seed a DB that only knows the v1 schema (no adaptationLog store).
    const v1 = new Dexie(name);
    v1.version(1).stores({
      profile: 'id',
      programs: 'id, active',
      checkIns: 'date',
      logs: 'id, date',
    });
    await v1.table('profile').put({ id: 'singleton', ...profile });
    const mockLog: SessionLog = {
      id: 'mock-pre-migration',
      date: '2026-06-01',
      warmupCompleted: true,
      blocks: [],
      sessionRPE: 7,
      durationMin: 60,
    };
    await v1.table('logs').put(mockLog);
    v1.close();

    // Re-open through the real repo, which upgrades the same DB to version(2).
    const repo = new DexieClimbRepo(name);
    expect(await repo.getProfile()).toEqual(profile); // v1 rows survived the upgrade
    expect(await repo.getLogs()).toEqual([mockLog]);

    // The v2-only store is usable after the upgrade.
    await repo.saveAdaptationLogEntry({ date: '2026-06-01', changes: [], neutralAssumed: true });
    expect(await repo.getAdaptationLog()).toHaveLength(1);
  });
});
