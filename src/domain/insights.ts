import type { SessionLog, CheckIn, VGrade, BodyPart } from './types';
import { formatGrade, VB } from './grade';
import { computeLoadMetrics } from './loadMetrics';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default trend window for the BC-38 charts — ~6 weeks, matching the load engine's history window. */
const SERIES_DAYS = 42;

function ageInDays(asOf: Date, dateIso: string): number {
  return Math.floor((asOf.getTime() - new Date(dateIso).getTime()) / DAY_MS);
}

/** Pure local-calendar date key for a point `daysAgo` before `asOf` (domain can't import app's localDateIso). */
function dayKey(asOf: Date, daysAgo: number): string {
  const d = new Date(asOf.getTime() - daysAgo * DAY_MS);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface GradePyramidEntry {
  grade: VGrade;
  count: number;
}

export interface SorenessTrend {
  date: string;
  bodyPart: BodyPart;
  severity: number;
  type: 'soreness' | 'pain';
}

export interface Insights {
  gradePyramid: GradePyramidEntry[];
  sorenessTrends: SorenessTrend[];
  totalSessions: number;
  averageSessionRPE: number;
}

export function computeInsights(logs: SessionLog[], checkIns: CheckIn[]): Insights {
  const gradePyramid = buildGradePyramid(logs);
  const sorenessTrends = buildSorenessTrends(checkIns);
  const totalSessions = logs.length;
  const averageSessionRPE =
    logs.length > 0
      ? Math.round((logs.reduce((s, l) => s + l.sessionRPE, 0) / logs.length) * 10) / 10
      : 0;
  return { gradePyramid, sorenessTrends, totalSessions, averageSessionRPE };
}

/** BC-38 — one day's total training load (sRPE × duration) for the load sparkline. */
export interface LoadPoint {
  date: string; // local YYYY-MM-DD
  load: number;
}

/** BC-38 — one day's EWMA-ACWR for the ACWR-trend sparkline. */
export interface AcwrPoint {
  date: string; // local YYYY-MM-DD
  acwr: number;
}

/** BC-38 — how many soreness/pain flags a body part collected in the window. */
export interface SorenessCount {
  bodyPart: BodyPart;
  count: number;
}

/**
 * BC-38 — daily total-load series over the last `days`, oldest → newest (so index maps
 * left → right on a chart). Rest days read 0; out-of-window and future logs are excluded.
 * Pure + `asOf`-driven; empty-safe (a full run of zeros, never NaN).
 */
export function loadSeries(logs: SessionLog[], asOf: Date, days = SERIES_DAYS): LoadPoint[] {
  const points: LoadPoint[] = [];
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const load = logs.reduce(
      (sum, l) => (ageInDays(asOf, l.date) === daysAgo ? sum + l.sessionRPE * l.durationMin : sum),
      0,
    );
    points.push({ date: dayKey(asOf, daysAgo), load });
  }
  return points;
}

/**
 * BC-38 — daily EWMA-ACWR trajectory over the last `days`, oldest → newest, by running the
 * *already-tested* `computeLoadMetrics` engine `asOf` each day (no ACWR re-implementation —
 * the safety-relevant math stays in the one 100%-covered, mutation-tested file).
 */
export function acwrSeries(logs: SessionLog[], asOf: Date, days = SERIES_DAYS): AcwrPoint[] {
  const points: AcwrPoint[] = [];
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const dayAsOf = new Date(asOf.getTime() - daysAgo * DAY_MS);
    points.push({ date: dayKey(asOf, daysAgo), acwr: computeLoadMetrics(logs, dayAsOf).acwr });
  }
  return points;
}

/**
 * BC-38 — soreness/pain flag frequency per body part within the last `days`, most-frequent
 * first (ties broken alphabetically for a stable render order). Out-of-window and future
 * check-ins are excluded. Pure + `asOf`-driven.
 */
export function sorenessFrequency(
  checkIns: CheckIn[],
  asOf: Date,
  days = SERIES_DAYS,
): SorenessCount[] {
  const counts = new Map<BodyPart, number>();
  for (const t of buildSorenessTrends(checkIns)) {
    const age = ageInDays(asOf, t.date);
    if (age < 0 || age >= days) continue;
    counts.set(t.bodyPart, (counts.get(t.bodyPart) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([bodyPart, count]) => ({ bodyPart, count }))
    .sort((a, b) => b.count - a.count || a.bodyPart.localeCompare(b.bodyPart));
}

/**
 * BC-51 — a deterministic, on-device coaching read over the same Insights data
 * (no LLM; that's BC-42). Returns 1–4 prioritised, supportive-coach sentences.
 * Safety always leads: a high ACWR or a recent sharp-pain flag is the first thing
 * said, mirroring the rules-engine precedence — the summary must never bury a risk
 * under an upbeat "keep pushing". Pure + `asOf`-driven (for the "recent" window).
 */
export function summariseInsights(insights: Insights, acwr: number, asOf: Date): string[] {
  if (insights.totalSessions === 0) {
    return ['Log a few sessions and I’ll start reading your trends — no data to go on yet.'];
  }

  const out: string[] = [];

  // 1) Safety first — load spike or a recent sharp pain leads the summary.
  const lastPain = insights.sorenessTrends
    .filter((t) => t.type === 'pain' && asOf.getTime() - new Date(t.date).getTime() <= 14 * DAY_MS)
    .at(-1);
  if (acwr > 1.5) {
    out.push(
      `Your training load is spiking (ACWR ${acwr.toFixed(2)}) — ease off and keep a rest day this week to stay healthy.`,
    );
  } else if (lastPain) {
    out.push(
      `You flagged ${lastPain.bodyPart} pain recently — respect it: easy days until it settles, and see a physio if it lingers.`,
    );
  } else if (acwr >= 1.3) {
    out.push(
      `Load is creeping up (ACWR ${acwr.toFixed(2)}) — hold intensity steady, no new max attempts yet.`,
    );
  }

  // 2) Pyramid read — broad base = ready to push the ceiling; top-heavy = broaden first.
  const max = insights.gradePyramid.at(-1);
  if (max) {
    const base = insights.gradePyramid
      .filter((e) => e.grade <= max.grade - 2)
      .reduce((n, e) => n + e.count, 0);
    if (base >= 5) {
      out.push(
        `Your base is broad (${base} sends a few grades below your max) — you’re ready to start touching ${formatGrade(max.grade + 1)}.`,
      );
    } else {
      out.push(
        `Your pyramid is top-heavy — broaden the base with more sends below ${formatGrade(max.grade)} before chasing harder grades.`,
      );
    }
  }

  // 3) Always close with a supportive consistency line.
  out.push(
    `${insights.totalSessions} sessions logged, average RPE ${insights.averageSessionRPE}. Consistency is the engine — keep showing up.`,
  );

  return out.slice(0, 4);
}

/** A target send-count per grade (BC-30): how full a healthy pyramid level is. */
export interface PyramidGap {
  grade: VGrade;
  actual: number;
  target: number;
  /** target − actual, floored at 0 (a level that's over-target is not a gap). */
  shortfall: number;
}

// Coaching model: a healthy send pyramid narrows to a single send at the goal and
// broadens by roughly the triangular numbers as you descend. Index = grades below
// the goal; the pyramid is capped at 5 levels deep (offset 0..4) so a far-off goal
// targets a base around `goal − 4`, not an unrealistic 2^n explosion.
const TARGET_COUNTS = [1, 3, 6, 10, 15] as const;
const MAX_DEPTH = TARGET_COUNTS.length - 1; // 4 grades below the goal

/**
 * BC-30 — the healthy target pyramid for a climber at `currentGrade` chasing
 * `goalGrade`: a single send at the goal, broadening downward. The base sits at the
 * broader of "two below current" (consolidate where you are) and "four below goal"
 * (cap the depth), never below VB. Pure, deterministic. Ascending by grade.
 */
export function pyramidTarget(currentGrade: VGrade, goalGrade: VGrade): GradePyramidEntry[] {
  // Depth = how many grades below the goal the base reaches: capped at MAX_DEPTH,
  // and pulled up to "two below current" so a close goal still broadens the base.
  // Mapping over a slice keeps every `count` provably defined (no tuple-index undef).
  const depth = Math.min(MAX_DEPTH, goalGrade - Math.max(VB, currentGrade - 2));
  return TARGET_COUNTS.slice(0, depth + 1)
    .map((count, offset) => ({ grade: goalGrade - offset, count }))
    .reverse(); // ascending by grade
}

/** BC-30 — the per-grade shortfall of an actual pyramid against a target. */
export function pyramidGaps(
  actual: GradePyramidEntry[],
  target: GradePyramidEntry[],
): PyramidGap[] {
  const have = new Map(actual.map((e) => [e.grade, e.count]));
  return target.map((t) => {
    const got = have.get(t.grade) ?? 0;
    return { grade: t.grade, actual: got, target: t.count, shortfall: Math.max(0, t.count - got) };
  });
}

/** BC-30 — the grade most under target (ties broaden the base: lower grade wins). */
export function biggestPyramidGap(gaps: PyramidGap[]): PyramidGap | null {
  let worst: PyramidGap | null = null;
  for (const g of gaps) {
    if (g.shortfall === 0) continue;
    if (
      !worst ||
      g.shortfall > worst.shortfall ||
      (g.shortfall === worst.shortfall && g.grade < worst.grade)
    ) {
      worst = g;
    }
  }
  return worst;
}

/**
 * BC-30 — a one-line plain-language read of the climber's pyramid vs the target for
 * their goal. Cold start (no sends) is honest, never NaN. When the base is thin it
 * names the grade to broaden; a complete pyramid is affirmed.
 */
export function describePyramidGap(
  actual: GradePyramidEntry[],
  currentGrade: VGrade,
  goalGrade: VGrade,
): string {
  if (actual.length === 0) {
    return 'Log a few sessions and I’ll read your send pyramid against your goal.';
  }
  const worst = biggestPyramidGap(pyramidGaps(actual, pyramidTarget(currentGrade, goalGrade)));
  if (!worst) {
    return `Your pyramid is solid all the way up to ${formatGrade(goalGrade)} — you’re ready to push the ceiling.`;
  }
  return `Your ${formatGrade(worst.grade)} base is thin (${worst.actual} of a target ${worst.target}) — broaden it before chasing ${formatGrade(goalGrade)}.`;
}

function buildGradePyramid(logs: SessionLog[]): GradePyramidEntry[] {
  const map = new Map<VGrade, number>();
  for (const log of logs) {
    for (const b of log.blocks) {
      for (const g of b.gradesSent) {
        map.set(g, (map.get(g) ?? 0) + 1);
      }
    }
  }
  return [...map.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => a.grade - b.grade);
}

function buildSorenessTrends(checkIns: CheckIn[]): SorenessTrend[] {
  const trends: SorenessTrend[] = [];
  for (const ci of checkIns) {
    for (const [bodyPart, severity] of Object.entries(ci.soreness)) {
      if (severity)
        trends.push({ date: ci.date, bodyPart: bodyPart as BodyPart, severity, type: 'soreness' });
    }
    for (const [bodyPart, severity] of Object.entries(ci.pain)) {
      if (severity)
        trends.push({ date: ci.date, bodyPart: bodyPart as BodyPart, severity, type: 'pain' });
    }
  }
  return trends.sort((a, b) => a.date.localeCompare(b.date));
}
