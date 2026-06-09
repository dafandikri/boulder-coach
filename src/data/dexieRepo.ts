import Dexie, { type Table } from 'dexie';
import type { CheckIn, Program, SessionLog, UserProfile } from '@/domain/types';
import type { IClimbRepo } from './IClimbRepo';

interface ProfileRow extends UserProfile {
  id: 'singleton';
}
interface ProgramRow {
  id: string;
  active: number; // 1 = active
  program: Program;
}
interface CheckInRow {
  date: string;
  checkIn: CheckIn;
}

class ClimbDB extends Dexie {
  profile!: Table<ProfileRow, string>;
  programs!: Table<ProgramRow, string>;
  checkIns!: Table<CheckInRow, string>;
  logs!: Table<SessionLog, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      programs: 'id, active',
      checkIns: 'date',
      logs: 'id, date',
    });
  }
}

export class DexieClimbRepo implements IClimbRepo {
  private db: ClimbDB;

  constructor(dbName = 'boulder-coach') {
    this.db = new ClimbDB(dbName);
  }

  async getProfile(): Promise<UserProfile | undefined> {
    const row = await this.db.profile.get('singleton');
    if (!row) return undefined;
    const { id: _id, ...profile } = row;
    return profile;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.db.profile.put({ id: 'singleton', ...profile });
  }

  async getActiveProgram(): Promise<Program | undefined> {
    const row = await this.db.programs.where('active').equals(1).first();
    return row?.program;
  }

  async saveProgram(program: Program): Promise<void> {
    await this.db.transaction('rw', this.db.programs, async () => {
      await this.db.programs.toCollection().modify({ active: 0 });
      await this.db.programs.put({ id: program.id, active: 1, program });
    });
  }

  async getCheckIn(dateIso: string): Promise<CheckIn | undefined> {
    const row = await this.db.checkIns.get(dateIso);
    return row?.checkIn;
  }

  async saveCheckIn(checkIn: CheckIn): Promise<void> {
    await this.db.checkIns.put({ date: checkIn.date, checkIn });
  }

  async getLogs(): Promise<SessionLog[]> {
    return this.db.logs.toArray();
  }

  async saveLog(log: SessionLog): Promise<void> {
    await this.db.logs.put(log);
  }
}
