import type { VGrade } from '@/domain/types';

/** Per-grade tally used by the session player. */
export type Tally = Partial<Record<VGrade, number>>;

export function warmupDone(warmupBlockIds: string[], checked: Set<string>): boolean {
  if (warmupBlockIds.length === 0) return true;
  return warmupBlockIds.every((id) => checked.has(id));
}

export function canFinishSession(
  warmupMandatory: boolean,
  warmupBlockIds: string[],
  checked: Set<string>,
): boolean {
  if (!warmupMandatory) return true;
  return warmupDone(warmupBlockIds, checked);
}

export function expandTally(tally: Partial<Record<VGrade, number>>): VGrade[] {
  const result: VGrade[] = [];
  for (const [grade, count] of Object.entries(tally)) {
    const g = Number(grade);
    if (Number.isInteger(g) && typeof count === 'number' && count > 0) {
      for (let i = 0; i < count; i++) result.push(g);
    }
  }
  return result;
}

/**
 * BC-65 — keep the attempts/sends counters coupled so a send (which is a successful
 * attempt) can never exceed attempts. Returns new tallies: sends are clamped to
 * attempts per grade, and attempts are bumped to match sends when needed.
 */
export function normalizeTallies(attempts: Tally, sends: Tally): { attempts: Tally; sends: Tally } {
  const nextAttempts: Tally = { ...attempts };
  const nextSends: Tally = { ...sends };
  const grades = new Set<VGrade>([
    ...Object.keys(attempts).map(Number),
    ...Object.keys(sends).map(Number),
  ]);

  for (const grade of grades) {
    const a = Math.max(0, nextAttempts[grade] ?? 0);
    const s = Math.max(0, nextSends[grade] ?? 0);
    const nextA = Math.max(a, s);
    nextAttempts[grade] = nextA;
    nextSends[grade] = Math.min(nextA, s);
  }

  return { attempts: nextAttempts, sends: nextSends };
}

function sumTally(tally: Tally): number {
  let sum = 0;
  for (const count of Object.values(tally)) {
    sum += Math.max(0, count ?? 0);
  }
  return sum;
}

/**
 * BC-65 follow-up — you cannot log individual climbs without having done at least
 * one set. Sets otherwise stay independent of attempts/sends (a set can contain many
 * attempts, and you can finish sets without logging every grade).
 */
export function ensureSetsForClimbs(setsCompleted: number, attempts: Tally, sends: Tally): number {
  const hasClimbs = sumTally(attempts) > 0 || sumTally(sends) > 0;
  if (hasClimbs && setsCompleted <= 0) return 1;
  return setsCompleted;
}
