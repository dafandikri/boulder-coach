import type { SessionLog, CheckIn, VGrade, BodyPart } from './types';

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
