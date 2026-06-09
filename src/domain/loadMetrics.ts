import type { SessionLog, LoadMetrics } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function loadOf(l: SessionLog): number {
  return l.sessionRPE * l.durationMin;
}

function daysBetween(asOf: Date, dateIso: string): number {
  const d = new Date(dateIso).getTime();
  return Math.floor((asOf.getTime() - d) / DAY_MS);
}

export function computeLoadMetrics(logs: SessionLog[], asOf: Date): LoadMetrics {
  let acute = 0;
  let chronicTotal = 0;
  for (const l of logs) {
    const age = daysBetween(asOf, l.date);
    if (age < 0) continue;
    if (age < 7) acute += loadOf(l);
    if (age < 28) chronicTotal += loadOf(l);
  }
  const chronic = chronicTotal / 4;
  const acwr = chronic === 0 ? 0 : Math.round((acute / chronic) * 100) / 100;
  return { acute, chronic, acwr };
}
