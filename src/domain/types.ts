import type { ExerciseContent } from './exerciseContent';

/** V-scale bouldering grade, e.g. 4 === V4. */
export type VGrade = number;

export type SessionType =
  | 'limit-boulder'
  | 'power-endurance'
  | 'volume-technique'
  | 'antagonist-prehab'
  | 'rest';

export type GripType = 'crimp' | 'open-hand' | 'mixed';

export type BodyPart = 'pip' | 'wrist-tfcc' | 'shoulder' | 'elbow';

export type BlockCategory = 'warmup' | 'main' | 'prehab' | 'technique' | 'cooldown';

export interface Block {
  id: string;
  name: string;
  category: BlockCategory;
  grip: GripType;
  /** number of work sets / problems */
  sets: number;
  targetGrade?: VGrade;
  targetRPE: number; // 1..10
  notes?: string;
  /** BC-47: detailed how-to (steps/cues/mistakes/image) shown in the session player,
   *  so tapping "Start" gives a self-guiding session, not just a one-line note. */
  content?: ExerciseContent;
}

export interface PlannedSession {
  id: string;
  programId: string;
  weekIndex: number;
  dayIndex: number;
  type: SessionType;
  blocks: Block[];
}

export type PhaseKind = 'hard' | 'peak' | 'deload';

export interface ProgramWeek {
  weekIndex: number;
  phase: PhaseKind;
  sessions: PlannedSession[];
}

export interface Program {
  id: string;
  startDate: string; // ISO date (local calendar date, see localDateIso)
  lengthWeeks: number;
  weeks: ProgramWeek[];
  // The current week is DERIVED from startDate + asOf (see domain/programClock),
  // never stored — a stored index froze the program at week 0 forever (BC-01).
}

export interface UserProfile {
  currentGrade: VGrade;
  goalGrade: VGrade;
  sessionsPerWeek: number; // 2..4
  availableWeekdays: number[]; // 0=Sun .. 6=Sat
}

/** 1..3 severity for soreness; 1..3 for sharp pain. Absent = none. */
export interface CheckIn {
  date: string; // ISO
  sleepQuality: number; // 1..5 (5 = great)
  overallFatigue: number; // 1..5 (5 = exhausted)
  soreness: Partial<Record<BodyPart, number>>;
  pain: Partial<Record<BodyPart, number>>;
  motivation: number; // 1..5
}

export interface LoggedBlock {
  blockId: string;
  setsCompleted: number;
  gradesAttempted: VGrade[];
  gradesSent: VGrade[];
  rpe: number; // 1..10
}

export interface SessionLog {
  id: string;
  date: string; // ISO
  plannedSessionId?: string;
  warmupCompleted: boolean;
  blocks: LoggedBlock[];
  sessionRPE: number; // 1..10
  durationMin: number;
  notes?: string;
}

export interface LoadMetrics {
  acute: number; // 7-day load sum
  chronic: number; // 28-day load as weekly-equivalent
  acwr: number; // acute / chronic, 0 when chronic is 0
}

export interface AdaptationChange {
  ruleId: string;
  reason: string;
}

export interface AdaptationResult {
  adjustedSession: PlannedSession;
  changes: AdaptationChange[];
  warmupMandatory: boolean;
}

/**
 * A persisted record of what the engine decided on a given local date and why
 * (BC-07). One entry per local date — re-deciding the same day overwrites it
 * (idempotent), so the "why" log never accumulates duplicates. `neutralAssumed`
 * is true when no check-in existed for the date and the engine assumed neutral.
 */
export interface AdaptationLogEntry {
  date: string; // local calendar date YYYY-MM-DD, see localDateIso
  changes: AdaptationChange[];
  neutralAssumed: boolean;
}
