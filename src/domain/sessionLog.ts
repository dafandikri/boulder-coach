import type { LoggedBlock, SessionLog, VGrade } from './types';

export interface BlockActual {
  blockId: string;
  setsCompleted: number;
  gradesAttempted: VGrade[];
  gradesSent: VGrade[];
  rpe: number; // 1..10
}

export interface SessionLogInput {
  date: string; // ISO yyyy-mm-dd
  plannedSessionId?: string;
  warmupCompleted: boolean;
  blocks: BlockActual[];
  /** Overall session RPE (1..10). If omitted, the hardest block RPE is used. */
  sessionRPE?: number;
  durationMin: number;
  notes?: string;
}

/** sRPE proxy: the session is as hard as its hardest block. */
export function suggestSessionRPE(blocks: { rpe: number }[]): number {
  return blocks.reduce((max, b) => Math.max(max, b.rpe), 0);
}

export function createSessionLog(input: SessionLogInput): SessionLog {
  const blocks: LoggedBlock[] = input.blocks.map((b) => ({
    blockId: b.blockId,
    setsCompleted: b.setsCompleted,
    gradesAttempted: b.gradesAttempted,
    gradesSent: b.gradesSent,
    rpe: b.rpe,
  }));
  return {
    id: `log-${input.date}`,
    date: input.date,
    plannedSessionId: input.plannedSessionId,
    warmupCompleted: input.warmupCompleted,
    blocks,
    sessionRPE: input.sessionRPE ?? suggestSessionRPE(input.blocks),
    durationMin: input.durationMin,
    notes: input.notes,
  };
}
