import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { DexieClimbRepo } from '../../../src/data/dexieRepo';
import {
  exportBackup,
  importBackup,
  parseBackup,
  backupFilename,
  BACKUP_VERSION,
  BackupError,
  type BackupV1,
} from '../../../src/app/lib/backup';
import type {
  AdaptationLogEntry,
  CheckIn,
  Program,
  SessionLog,
  UserProfile,
} from '../../../src/domain/types';

// All fixtures carry a `mock` marker so they're unmistakably test data.
const mockProfile: UserProfile = {
  currentGrade: 5,
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5],
  injuryHistory: ['pip', 'shoulder'], // BC-29: must survive export → import
};

const mockProgram: Program = {
  id: 'prog-mock-1',
  startDate: '2026-06-09',
  lengthWeeks: 6,
  weeks: [],
};

const mockCheckIns: CheckIn[] = [
  {
    date: '2026-06-09',
    sleepQuality: 4,
    overallFatigue: 2,
    soreness: {},
    pain: {},
    motivation: 4,
  },
  {
    date: '2026-06-11',
    sleepQuality: 3,
    overallFatigue: 3,
    soreness: { elbow: 1 },
    pain: {},
    motivation: 3,
  },
];

const mockLogs: SessionLog[] = [
  {
    id: 'log-mock-1',
    date: '2026-06-09',
    warmupCompleted: true,
    blocks: [],
    sessionRPE: 8,
    durationMin: 60,
    notes: 'mock session',
  },
  {
    id: 'log-mock-2',
    date: '2026-06-11',
    warmupCompleted: false,
    blocks: [],
    sessionRPE: 7,
    durationMin: 50,
  },
];

const mockAdaptationLog: AdaptationLogEntry[] = [
  {
    date: '2026-06-09',
    changes: [{ ruleId: 'rule-mock-1', reason: 'mock: eased volume' }],
    neutralAssumed: false,
  },
  { date: '2026-06-11', changes: [], neutralAssumed: true },
];

async function seed(repo: DexieClimbRepo): Promise<void> {
  await repo.saveProfile(mockProfile);
  await repo.saveProgram(mockProgram);
  for (const c of mockCheckIns) await repo.saveCheckIn(c);
  for (const l of mockLogs) await repo.saveLog(l);
  for (const e of mockAdaptationLog) await repo.saveAdaptationLogEntry(e);
}

describe('exportBackup', () => {
  let repo: DexieClimbRepo;
  beforeEach(() => {
    repo = new DexieClimbRepo(`test-export-${Math.random()}`);
  });

  it('produces a versioned blob with profile, program, check-ins and logs', async () => {
    await seed(repo);
    const backup = await exportBackup(repo);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.profile).toEqual(mockProfile);
    expect(backup.program).toEqual(mockProgram);
    expect(backup.checkIns).toHaveLength(2);
    expect(backup.logs).toHaveLength(2);
    expect(backup.adaptationLog).toHaveLength(2);
    expect(typeof backup.exportedAt).toBe('string');
  });

  it('represents an empty store with nulls/empty arrays, still valid', async () => {
    const backup = await exportBackup(repo);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.profile).toBeNull();
    expect(backup.program).toBeNull();
    expect(backup.checkIns).toEqual([]);
    expect(backup.logs).toEqual([]);
    expect(backup.adaptationLog).toEqual([]);
    // an empty export must still re-parse cleanly
    expect(() => parseBackup(JSON.stringify(backup))).not.toThrow();
  });
});

describe('parseBackup (import validation)', () => {
  it('rejects non-JSON with a typed BackupError', () => {
    expect(() => parseBackup('not json {')).toThrow(BackupError);
  });

  it('rejects a non-object payload', () => {
    expect(() => parseBackup('42')).toThrow(BackupError);
    expect(() => parseBackup('null')).toThrow(BackupError);
    expect(() => parseBackup('[]')).toThrow(BackupError);
  });

  it('rejects a missing/unknown version (future migration hook)', () => {
    expect(() => parseBackup(JSON.stringify({ checkIns: [], logs: [] }))).toThrow(BackupError);
    expect(() =>
      parseBackup(
        JSON.stringify({ version: 999, profile: null, program: null, checkIns: [], logs: [] }),
      ),
    ).toThrow(/version/i);
  });

  it('rejects when checkIns or logs are not arrays', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: BACKUP_VERSION,
          profile: null,
          program: null,
          checkIns: 'nope',
          logs: [],
        }),
      ),
    ).toThrow(BackupError);
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: BACKUP_VERSION,
          profile: null,
          program: null,
          checkIns: [],
          logs: {},
        }),
      ),
    ).toThrow(BackupError);
  });

  it('rejects when adaptationLog is not an array', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: BACKUP_VERSION,
          profile: null,
          program: null,
          checkIns: [],
          logs: [],
          adaptationLog: 'nope',
        }),
      ),
    ).toThrow(BackupError);
  });

  it('accepts a well-formed blob and returns it typed', () => {
    const blob: BackupV1 = {
      version: BACKUP_VERSION,
      exportedAt: '2026-06-11T00:00:00.000Z',
      profile: mockProfile,
      program: mockProgram,
      checkIns: mockCheckIns,
      logs: mockLogs,
      adaptationLog: mockAdaptationLog,
    };
    const parsed = parseBackup(JSON.stringify(blob));
    expect(parsed).toEqual(blob);
  });

  it('coerces a non-string exportedAt (corrupt/legacy backup) to an empty string', () => {
    // A hand-edited or pre-v1 export can carry a missing/numeric exportedAt. The
    // structural parse must not crash on it — it falls back to '' so the restore
    // proceeds. (Covers the `: ''` branch of the exportedAt guard.)
    const blob = {
      version: BACKUP_VERSION,
      exportedAt: 0, // not a string — the corrupt/legacy case
      profile: null,
      program: null,
      checkIns: [],
      logs: [],
      adaptationLog: [],
    };
    const parsed = parseBackup(JSON.stringify(blob));
    expect(parsed.exportedAt).toBe('');
  });
});

describe('importBackup', () => {
  let repo: DexieClimbRepo;
  beforeEach(() => {
    repo = new DexieClimbRepo(`test-import-${Math.random()}`);
  });

  it('replaces existing data (wipe then restore)', async () => {
    // pre-existing data that must be wiped
    await repo.saveProfile({ ...mockProfile, currentGrade: 1 });
    await repo.saveLog({
      id: 'log-mock-stale',
      date: '2020-01-01',
      warmupCompleted: false,
      blocks: [],
      sessionRPE: 5,
      durationMin: 30,
    });

    // a stale adaptation entry that replace-import must wipe (BC-07 store)
    await repo.saveAdaptationLogEntry({ date: '2020-01-01', changes: [], neutralAssumed: true });

    const blob: BackupV1 = {
      version: BACKUP_VERSION,
      exportedAt: '2026-06-11T00:00:00.000Z',
      profile: mockProfile,
      program: mockProgram,
      checkIns: mockCheckIns,
      logs: mockLogs,
      adaptationLog: mockAdaptationLog,
    };
    await importBackup(repo, JSON.stringify(blob));

    expect(await repo.getProfile()).toEqual(mockProfile);
    expect((await repo.getActiveProgram())?.id).toBe('prog-mock-1');
    expect(await repo.getCheckIns()).toHaveLength(2);
    const logs = await repo.getLogs();
    expect(logs).toHaveLength(2);
    expect(logs.some((l) => l.id === 'log-mock-stale')).toBe(false);
    const adaptationLog = await repo.getAdaptationLog();
    expect(adaptationLog).toHaveLength(2);
    expect(adaptationLog.some((e) => e.date === '2020-01-01')).toBe(false);
  });

  it('clears everything when importing an empty backup', async () => {
    await seed(repo);
    const empty: BackupV1 = {
      version: BACKUP_VERSION,
      exportedAt: '2026-06-11T00:00:00.000Z',
      profile: null,
      program: null,
      checkIns: [],
      logs: [],
      adaptationLog: [],
    };
    await importBackup(repo, JSON.stringify(empty));
    expect(await repo.getProfile()).toBeUndefined();
    expect(await repo.getActiveProgram()).toBeUndefined();
    expect(await repo.getCheckIns()).toEqual([]);
    expect(await repo.getLogs()).toEqual([]);
    expect(await repo.getAdaptationLog()).toEqual([]);
  });

  it('does NOT wipe the store when the blob is invalid (fail before destroy)', async () => {
    await seed(repo);
    await expect(importBackup(repo, 'garbage {')).rejects.toThrow(BackupError);
    // original data intact
    expect(await repo.getProfile()).toEqual(mockProfile);
    expect(await repo.getLogs()).toHaveLength(2);
  });
});

describe('backupFilename', () => {
  it('stamps the download name with the local calendar date', () => {
    // fixed mock date so the name is deterministic (test marker: mock date)
    expect(backupFilename(new Date('2026-06-11T08:30:00.000Z'))).toBe(
      'boulder-coach-backup-2026-06-11.json',
    );
  });
});

describe('round-trip', () => {
  it('seed → export → wipe → import restores identical state', async () => {
    const original = new DexieClimbRepo(`test-roundtrip-${Math.random()}`);
    await seed(original);

    const exported = await exportBackup(original);
    const json = JSON.stringify(exported);

    // wipe the same repo, then import back
    await original.clearAll();
    expect(await original.getProfile()).toBeUndefined();
    expect(await original.getLogs()).toEqual([]);

    await importBackup(original, json);

    const restored = await original.getProfile();
    expect(restored).toEqual(mockProfile);
    expect(restored?.injuryHistory).toEqual(['pip', 'shoulder']); // BC-29 round-trips
    expect(await original.getActiveProgram()).toEqual(mockProgram);
    expect(await original.getCheckIns()).toEqual(mockCheckIns);
    const logs = await original.getLogs();
    expect(logs).toHaveLength(2);
    expect(new Set(logs.map((l) => l.id))).toEqual(new Set(['log-mock-1', 'log-mock-2']));
    expect(await original.getAdaptationLog()).toEqual(mockAdaptationLog);
  });
});
