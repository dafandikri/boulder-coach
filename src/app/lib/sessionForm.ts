import type { VGrade } from '@/domain/types';

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
