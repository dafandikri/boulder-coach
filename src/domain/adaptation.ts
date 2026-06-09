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

/** Deep-ish clone so rules never mutate the planned template. */
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

export function adapt(
  planned: PlannedSession,
  checkIn: CheckIn,
  _recentLogs: SessionLog[],
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
    // Remove crimp/loaded grip from main work; force open-hand.
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

  return { adjustedSession: session, changes, warmupMandatory };
}
