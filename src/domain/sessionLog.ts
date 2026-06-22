import type { LoggedBlock, SessionLog, VGrade } from './types';

function countByGrade(grades: VGrade[]): Record<VGrade, number> {
  const counts: Record<VGrade, number> = {};
  for (const g of grades) {
    counts[g] = (counts[g] ?? 0) + 1;
  }
  return counts;
}

/**
 * BC-65 — enforce the physical invariant that a send is a successful attempt:
 * for each grade, the number of sends cannot exceed the number of attempts.
 * Preserves the order of `sent` up to the clamp so downstream analytics are stable.
 */
export function clampSentToAttempted(attempted: VGrade[], sent: VGrade[]): VGrade[] {
  const attemptedCounts = countByGrade(attempted);
  const consumed: Record<VGrade, number> = {};
  const result: VGrade[] = [];

  for (const g of sent) {
    const limit = attemptedCounts[g] ?? 0;
    const used = consumed[g] ?? 0;
    if (used < limit) {
      result.push(g);
      consumed[g] = used + 1;
    }
  }

  return result;
}

export interface BlockActual {
  blockId: string;
  setsCompleted: number;
  gradesAttempted: VGrade[];
  gradesSent: VGrade[];
  rpe: number; // 1..10
}

export interface SessionLogInput {
  date: string; // ISO yyyy-mm-dd
  /** BC-64: explicit id. Omitted by the planned-session player so it stays
   *  `log-<date>` (idempotent — re-finishing a day overwrites). Freeform logs
   *  supply a unique id so multiple logs can coexist on one local day. */
  id?: string;
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
    gradesSent: clampSentToAttempted(b.gradesAttempted, b.gradesSent),
    rpe: b.rpe,
  }));
  return {
    id: input.id ?? `log-${input.date}`,
    date: input.date,
    plannedSessionId: input.plannedSessionId,
    warmupCompleted: input.warmupCompleted,
    blocks,
    sessionRPE: input.sessionRPE ?? suggestSessionRPE(input.blocks),
    durationMin: input.durationMin,
    notes: input.notes,
  };
}
