import type { SessionLog, LoadMetrics } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * EWMA-ACWR (Williams et al. 2017) — the acute:chronic workload ratio computed from
 * exponentially-weighted moving averages of the daily-load series instead of rolling
 * sums. Decay constants follow λ = 2/(N+1):
 *   - acute   N = 7  → λ = 0.25      (responds within ~a week)
 *   - chronic N = 28 → λ = 2/29      (a ~monthly baseline)
 *
 * Both EWMAs are SEEDED with the first in-window day's load, so a climber's very first
 * session — or first training week — reads as ACWR ≈ 1.0 rather than the false 4× spike
 * the rolling acute/(chronic÷4) method produced on cold start (it divided a single
 * week's load by four weeks that didn't exist yet). A genuine spike on an established
 * base still crosses the > 1.5 deload threshold, because acute (λ 0.25) climbs far
 * faster than chronic (λ 2/29).
 *
 * Pure: no I/O, no Date.now() — the caller passes `asOf`. See the canonical definition
 * in skills/domain-rule-authoring and docs/specs/2026-06-09-bouldering-coach-app-design.md.
 */

const LAMBDA_ACUTE = 2 / (7 + 1); // 0.25
const LAMBDA_CHRONIC = 2 / (28 + 1); // ≈ 0.0690
/** Days of history that warm up the chronic EWMA; older logs (and a long layoff) are BC-08's concern. */
const WINDOW_DAYS = 42;

function loadOf(l: SessionLog): number {
  return l.sessionRPE * l.durationMin;
}

function ageInDays(asOf: Date, dateIso: string): number {
  return Math.floor((asOf.getTime() - new Date(dateIso).getTime()) / DAY_MS);
}

export function computeLoadMetrics(logs: SessionLog[], asOf: Date): LoadMetrics {
  // In-window (age, load) entries — exclude future (age < 0) and pre-window logs.
  const inWindow = logs
    .map((l) => ({ age: ageInDays(asOf, l.date), load: loadOf(l) }))
    .filter((e) => e.age >= 0 && e.age < WINDOW_DAYS);
  if (inWindow.length === 0) return { acute: 0, chronic: 0, acwr: 0 };

  // Walk the daily series oldest → today, seeding both EWMAs with the first day's
  // total load (so cold-start reads ~1.0). Rest days contribute a 0-load step.
  const oldest = Math.max(...inWindow.map((e) => e.age));
  let ewmaAcute = 0;
  let ewmaChronic = 0;
  for (let age = oldest; age >= 0; age--) {
    const load = inWindow.reduce((sum, e) => (e.age === age ? sum + e.load : sum), 0);
    if (age === oldest) {
      ewmaAcute = load;
      ewmaChronic = load;
    } else {
      ewmaAcute = load * LAMBDA_ACUTE + ewmaAcute * (1 - LAMBDA_ACUTE);
      ewmaChronic = load * LAMBDA_CHRONIC + ewmaChronic * (1 - LAMBDA_CHRONIC);
    }
  }

  const acwr = ewmaChronic === 0 ? 0 : Math.round((ewmaAcute / ewmaChronic) * 100) / 100;
  return { acute: Math.round(ewmaAcute), chronic: Math.round(ewmaChronic), acwr };
}
