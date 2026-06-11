import type { AdaptationLogEntry, CheckIn, Program, SessionLog, UserProfile } from '@/domain/types';
import type { IClimbRepo } from '@/data/IClimbRepo';
import { localDateIso } from '@/app/lib/date';

/**
 * Schema version of the export blob. Bump when the shape changes so import can
 * branch on it (migrate or reject). v1 is the only shape we read today.
 */
export const BACKUP_VERSION = 1 as const;

/**
 * A single, versioned snapshot of everything `IClimbRepo` persists. This is the
 * on-disk JSON contract for export/import (BC-10) and the future cloud-migration
 * payload. Absent profile/program serialize as `null` (JSON has no `undefined`).
 */
export interface BackupV1 {
  version: typeof BACKUP_VERSION;
  /** ISO timestamp the export was taken — informational, not used on import. */
  exportedAt: string;
  profile: UserProfile | null;
  program: Program | null;
  checkIns: CheckIn[];
  logs: SessionLog[];
  /** BC-07's persisted "why" log — past decisions are not regenerable, so a
   *  faithful backup must carry them (and import must restore them). */
  adaptationLog: AdaptationLogEntry[];
}

/**
 * Thrown when an import blob is not a backup we can restore (bad JSON, wrong
 * shape, or an unknown version). Fails loudly *before* any data is touched so a
 * malformed file can never silently corrupt or wipe the store.
 */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Read the full store through the seam and assemble a versioned snapshot. */
export async function exportBackup(repo: IClimbRepo): Promise<BackupV1> {
  const [profile, program, checkIns, logs, adaptationLog] = await Promise.all([
    repo.getProfile(),
    repo.getActiveProgram(),
    repo.getCheckIns(),
    repo.getLogs(),
    repo.getAdaptationLog(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    program: program ?? null,
    checkIns,
    logs,
    adaptationLog,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse + validate raw text into a `BackupV1`. Throws `BackupError` on any
 * problem (bad JSON, non-object, wrong/missing version, non-array collections).
 * Structural-only: it guarantees the container shape so the restore can't crash
 * mid-write; per-record field validation is the domain's job at read time.
 */
export function parseBackup(text: string): BackupV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('File is not valid JSON.');
  }
  if (!isRecord(raw)) {
    throw new BackupError('Backup must be a JSON object.');
  }
  if (raw.version !== BACKUP_VERSION) {
    throw new BackupError(
      `Unsupported backup version: expected ${BACKUP_VERSION}, got ${String(raw.version)}.`,
    );
  }
  if (!Array.isArray(raw.checkIns) || !Array.isArray(raw.logs)) {
    throw new BackupError('Backup is missing its check-ins or logs list.');
  }
  if (!Array.isArray(raw.adaptationLog)) {
    throw new BackupError('Backup is missing its adaptation log.');
  }
  // Shape is verified; the discriminated `version` lets us assert to BackupV1.
  return {
    version: BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    profile: (raw.profile as UserProfile | null) ?? null,
    program: (raw.program as Program | null) ?? null,
    checkIns: raw.checkIns as CheckIn[],
    logs: raw.logs as SessionLog[],
    adaptationLog: raw.adaptationLog as AdaptationLogEntry[],
  };
}

/**
 * Restore a backup with REPLACE semantics: validate first (throws before any
 * write), then wipe the store and write the snapshot back. The caller (UI) owns
 * the "this erases your current data" confirmation before calling this.
 */
export async function importBackup(repo: IClimbRepo, text: string): Promise<void> {
  const backup = parseBackup(text); // throws BackupError before we destroy anything
  await repo.clearAll();
  if (backup.profile) await repo.saveProfile(backup.profile);
  if (backup.program) await repo.saveProgram(backup.program);
  for (const checkIn of backup.checkIns) await repo.saveCheckIn(checkIn);
  for (const log of backup.logs) await repo.saveLog(log);
  for (const entry of backup.adaptationLog) await repo.saveAdaptationLogEntry(entry);
}

/** Filename for a downloaded export, stamped with the local calendar date. */
export function backupFilename(now: Date = new Date()): string {
  // Local calendar date (BC-02): a UTC slice would mis-stamp the file before
  // 07:00 WIB. Reuses the shared helper so there's one timezone rule app-wide.
  return `boulder-coach-backup-${localDateIso(now)}.json`;
}
