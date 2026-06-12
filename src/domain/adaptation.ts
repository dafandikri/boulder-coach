import type {
  AdaptationChange,
  AdaptationResult,
  Block,
  BodyPart,
  CheckIn,
  LoadMetrics,
  PlannedSession,
  SessionLog,
} from './types';
import { VB, MAX_GRADE, formatGrade } from './grade';

function cloneSession(s: PlannedSession): PlannedSession {
  return { ...s, blocks: s.blocks.map((b) => ({ ...b })) };
}

function mainBlocks(s: PlannedSession): Block[] {
  return s.blocks.filter((b) => b.category === 'main');
}

function scaleMainVolume(s: PlannedSession, factor: number): void {
  for (const b of s.blocks) {
    if (b.category === 'main') {
      b.sets = Math.max(1, Math.round(b.sets * factor));
    }
  }
}

function prehabBlock(): Block {
  return {
    id: 'inserted-prehab',
    name: 'Prehab + technique (substituted)',
    category: 'prehab',
    grip: 'open-hand',
    sets: 3,
    targetRPE: 5,
    notes: 'Joint-specific prehab and easy technique work.',
  };
}

const PART_LABEL: Record<BodyPart, string> = {
  pip: 'finger (PIP)',
  'wrist-tfcc': 'wrist (TFCC)',
  shoulder: 'shoulder',
  elbow: 'elbow',
};

function firstFlagged(map: Partial<Record<BodyPart, number>>): BodyPart | undefined {
  return (Object.keys(map) as BodyPart[]).find((k) => (map[k] ?? 0) > 0);
}

function recentBlockLogs(blockId: string, logs: SessionLog[], n: number): SessionLog[] {
  return logs
    .filter((l) => l.blocks.some((b) => b.blockId === blockId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

export function adapt(
  planned: PlannedSession,
  checkIn: CheckIn,
  recentLogs: SessionLog[],
  metrics: LoadMetrics,
): AdaptationResult {
  const session = cloneSession(planned);
  const changes: AdaptationChange[] = [];
  let warmupMandatory = false;

  // Rule 1 — sharp pain (highest priority).
  const painPart = firstFlagged(checkIn.pain);
  if (painPart) {
    warmupMandatory = true;
    scaleMainVolume(session, 0.5);
    for (const b of session.blocks) {
      if (b.category === 'main' && b.grip !== 'open-hand') b.grip = 'open-hand';
    }
    session.blocks.push(prehabBlock());
    changes.push({
      ruleId: 'pain',
      reason: `${PART_LABEL[painPart]} pain flagged — cut volume 50%, open-hand only, added prehab. See a physio if it persists.`,
    });
    return { adjustedSession: session, changes, warmupMandatory };
  }

  // Rule 2 — soreness (no sharp pain).
  const sorePart = firstFlagged(checkIn.soreness);
  if (sorePart) {
    warmupMandatory = true;
    for (const b of mainBlocks(session)) {
      if (b.grip === 'crimp' || b.grip === 'mixed') b.grip = 'open-hand';
      b.targetRPE = Math.max(5, b.targetRPE - 1);
    }
    changes.push({
      ruleId: 'soreness',
      reason: `${PART_LABEL[sorePart]} sore — switched to open-hand and dialled intensity back one notch.`,
    });
  }

  // Rule 3 — ACWR high → force deload.
  if (metrics.acwr > 1.5) {
    scaleMainVolume(session, 0.6);
    for (const b of mainBlocks(session)) b.targetRPE = Math.min(b.targetRPE, 6);
    changes.push({
      ruleId: 'acwr-high',
      reason: `Load ratio hit ${metrics.acwr} — deloading (volume −40%, easy intensity) to avoid injury.`,
    });
    return { adjustedSession: session, changes, warmupMandatory };
  }

  // Rule 4 — ACWR caution band → cap intensity.
  if (metrics.acwr >= 1.3) {
    for (const b of mainBlocks(session)) b.targetRPE = Math.min(b.targetRPE, 8);
    changes.push({
      ruleId: 'acwr-caution',
      reason: `Load creeping up (ratio ${metrics.acwr}) — holding intensity steady, no new max attempts.`,
    });
  }

  // Rule 5 — fatigue / poor sleep.
  if (checkIn.overallFatigue >= 4 || checkIn.sleepQuality <= 2) {
    scaleMainVolume(session, 0.8);
    for (const b of mainBlocks(session)) b.targetRPE = Math.max(5, b.targetRPE - 1);
    changes.push({
      ruleId: 'fatigue',
      reason: 'Rough sleep / high fatigue — trimmed volume ~20% and lowered the RPE target.',
    });
  }

  // Progression rules 6-7: only fire when no safety rule (1-5) made a change.
  if (changes.length === 0) {
    for (const b of mainBlocks(session)) {
      const target = b.targetGrade;
      if (target === undefined) continue;

      const blockLogs = recentBlockLogs(b.id, recentLogs, 2);
      if (blockLogs.length < 2) continue;

      const allCrushing = blockLogs.every((l) =>
        l.blocks.some(
          (lb) =>
            lb.blockId === b.id &&
            lb.gradesSent.some((g) => g >= target) &&
            lb.rpe <= b.targetRPE - 1,
        ),
      );

      const allMissing = blockLogs.every(
        (l) =>
          !l.blocks.some((lb) => lb.blockId === b.id && lb.gradesSent.some((g) => g >= target)),
      );

      if (allCrushing) {
        b.targetGrade = Math.min(MAX_GRADE, target + 1);
        changes.push({
          ruleId: 'progression',
          reason: `Crushing your targets — bumped grade from ${formatGrade(target)} to ${formatGrade(b.targetGrade)}. Keep it up!`,
        });
      } else if (allMissing) {
        // Ease DOWN toward the scale floor (VB), never up — a beginner missing a
        // V0/VB target must not be pushed harder (additive-safety: regression only lowers).
        b.targetGrade = Math.max(VB, target - 1);
        changes.push({
          ruleId: 'regression',
          reason: `Missed targets on the last 2 sessions — eased grade from ${formatGrade(target)} to ${formatGrade(b.targetGrade)} to build confidence.`,
        });
      }
    }
  }

  return { adjustedSession: session, changes, warmupMandatory };
}
