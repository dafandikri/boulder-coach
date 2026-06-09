import type { CheckIn, Program, SessionLog, UserProfile } from '@/domain/types';

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
  saveCheckIn(checkIn: CheckIn): Promise<void>;

  getLogs(): Promise<SessionLog[]>;
  saveLog(log: SessionLog): Promise<void>;
}
