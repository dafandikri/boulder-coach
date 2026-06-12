import type { SessionLog, CheckIn, VGrade, BodyPart } from './types';
import { formatGrade } from './grade';

const DAY_MS = 24 * 60 * 60 * 1000;

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
