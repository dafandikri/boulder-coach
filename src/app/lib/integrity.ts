// BC-32 — load-time integrity validation. IndexedDB rows are typed as domain entities
// at the seam, but a truncated write or a hand-edited/partial import can leave a record
// whose runtime shape lies about its type. An unvalidated corrupt log can NaN the load
// engine (sessionRPE × durationMin) — so `validateLog` guards the top-level fields the
// engine reads (finite sessionRPE/durationMin, string id/date, array blocks). A bad record
// is QUARANTINED and surfaced ("your data looks damaged — re-import a backup"), never
// crashed on mid-render. (Block-level contents are not deep-validated — out of scope for
// the load-engine threat.) Pure: no I/O, safe to import anywhere.

import type { SessionLog } from '@/domain/types';
import { clampSentToAttempted } from '@/domain/sessionLog';

export type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

export interface QuarantinedRecord {
  reason: string;
  raw: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Validate the runtime shape of a stored session log. */
export function validateLog(raw: unknown): Validated<SessionLog> {
  if (!isRecord(raw)) return { ok: false, reason: 'log is not an object' };
  if (typeof raw.id !== 'string') return { ok: false, reason: 'log id is missing or not a string' };
  if (typeof raw.date !== 'string')
    return { ok: false, reason: 'log date is missing or not a string' };
  if (typeof raw.warmupCompleted !== 'boolean') {
    return { ok: false, reason: 'log warmupCompleted is not a boolean' };
  }
  if (!Array.isArray(raw.blocks)) return { ok: false, reason: 'log blocks is not an array' };
  if (!isFiniteNumber(raw.sessionRPE)) {
    return { ok: false, reason: 'log sessionRPE is not a finite number' };
  }
  if (!isFiniteNumber(raw.durationMin)) {
    return { ok: false, reason: 'log durationMin is not a finite number' };
  }
  return { ok: true, value: raw as unknown as SessionLog };
}

/** BC-65 — repair recoverable per-block corruption rather than dropping it. */
function sanitizeLog(log: SessionLog): SessionLog {
  return {
    ...log,
    blocks: log.blocks.map((b) => ({
      ...b,
      gradesSent: clampSentToAttempted(b.gradesAttempted, b.gradesSent),
    })),
  };
}

/** Split raw stored logs into the usable ones and the corrupt ones to quarantine. */
export function partitionLogs(rawLogs: unknown[]): {
  valid: SessionLog[];
  quarantined: QuarantinedRecord[];
} {
  const valid: SessionLog[] = [];
  const quarantined: QuarantinedRecord[] = [];
  for (const raw of rawLogs) {
    const result = validateLog(raw);
    if (result.ok) valid.push(sanitizeLog(result.value));
    else quarantined.push({ reason: result.reason, raw });
  }
  return { valid, quarantined };
}
