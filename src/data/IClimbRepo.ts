import type { AdaptationLogEntry, CheckIn, Program, SessionLog, UserProfile } from '@/domain/types';

/**
 * Storage seam. The Dexie impl backs this now; a cloud impl can replace it
 * later without touching domain or UI code.
 */
export interface IClimbRepo {
  getProfile(): Promise<UserProfile | undefined>;
  saveProfile(profile: UserProfile): Promise<void>;

  getActiveProgram(): Promise<Program | undefined>;
  saveProgram(program: Program): Promise<void>;

  getCheckIn(dateIso: string): Promise<CheckIn | undefined>;
  getCheckIns(): Promise<CheckIn[]>;
  saveCheckIn(checkIn: CheckIn): Promise<void>;

  getLogs(): Promise<SessionLog[]>;
  saveLog(log: SessionLog): Promise<void>;

  /** BC-07: the persisted "why" log. Keyed by local date; saving the same date
   *  overwrites (idempotent), so re-rendering a day never duplicates an entry. */
  getAdaptationLog(): Promise<AdaptationLogEntry[]>;
  saveAdaptationLogEntry(entry: AdaptationLogEntry): Promise<void>;

  /**
   * Wipe every persisted record (profile, programs, check-ins, logs, adaptation
   * log). The only destructive bulk operation — used by import (replace
   * semantics, BC-10). A cloud impl must clear the same logical scope a single
   * export covers.
   */
  clearAll(): Promise<void>;
}
