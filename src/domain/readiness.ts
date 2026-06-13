// BC-28 — an at-a-glance "how ready am I today" signal for the Today screen.
// Pure: no I/O, no React, no Date. Combines the check-in (sleep / fatigue / soreness
// / pain / motivation) with the load ratio, biased toward safety the same way the
// rules engine is: any sharp pain or an ACWR above 1.5 forces `red` regardless of the
// rest (mirrors adaptation.ts rules 1 and 3). This is a read-out, not a rule — it
// never changes the prescription; it just explains the climber's overall state.

import type { BodyPart, CheckIn, LoadMetrics } from './types';

export type ReadinessBand = 'green' | 'amber' | 'red';

export interface ReadinessResult {
  /** 0..100, higher = more recovered/ready. */
  score: number;
  band: ReadinessBand;
  /** Plain-language reasons, most significant first (Today shows the top 1–2). */
  drivers: string[];
}

const PART_LABEL: Record<BodyPart, string> = {
  pip: 'finger',
  'wrist-tfcc': 'wrist',
  shoulder: 'shoulder',
  elbow: 'elbow',
};

const PARTS: BodyPart[] = ['pip', 'wrist-tfcc', 'shoulder', 'elbow'];

/** ACWR above this forces red — the rules-engine danger threshold (adaptation rule 3). */
const ACWR_DANGER = 1.5;
/** ACWR at/above this is the caution band (adaptation rule 4). */
const ACWR_CAUTION = 1.3;

/** The worst-affected body part and its severity (0 when none flagged). */
function worst(map: Partial<Record<BodyPart, number>>): { part: BodyPart | null; value: number } {
  let part: BodyPart | null = null;
  let value = 0;
  for (const p of PARTS) {
    const v = map[p] ?? 0;
    if (v > value) {
      value = v;
      part = p;
    }
  }
  return { part, value };
}

export function computeReadiness(checkIn: CheckIn, metrics: LoadMetrics): ReadinessResult {
  const sore = worst(checkIn.soreness);
  const pain = worst(checkIn.pain);

  // Score: start at 100 and dock points for each negative signal. Weights are
  // deliberately simple and deterministic; pain and a spiking ACWR dominate.
  const score = clamp(
    100 -
      (5 - checkIn.sleepQuality) * 8 -
      (checkIn.overallFatigue - 1) * 9 -
      sore.value * 7 -
      pain.value * 14 -
      (metrics.acwr > ACWR_CAUTION ? (metrics.acwr - ACWR_CAUTION) * 50 : 0) +
      (checkIn.motivation - 3) * 3,
  );

  // Safety bias: sharp pain or a spiking ACWR forces red no matter the score.
  const forcedRed = pain.value > 0 || metrics.acwr > ACWR_DANGER;
  const band: ReadinessBand = forcedRed
    ? 'red'
    : score >= 70
      ? 'green'
      : score >= 45
        ? 'amber'
        : 'red';

  return { score, band, drivers: buildDrivers(checkIn, metrics, sore, pain, band) };
}

function buildDrivers(
  checkIn: CheckIn,
  metrics: LoadMetrics,
  sore: { part: BodyPart | null; value: number },
  pain: { part: BodyPart | null; value: number },
  band: ReadinessBand,
): string[] {
  const weighted: { weight: number; text: string }[] = [];
  if (pain.part) {
    weighted.push({
      weight: 100,
      text: `sharp ${PART_LABEL[pain.part]} pain — back off and let it settle`,
    });
  }
  if (metrics.acwr > ACWR_DANGER) {
    weighted.push({
      weight: 90,
      text: `load spiking fast (ACWR ${metrics.acwr.toFixed(1)}) — keep it easy`,
    });
  } else if (metrics.acwr >= ACWR_CAUTION) {
    weighted.push({ weight: 60, text: `load creeping up (ACWR ${metrics.acwr.toFixed(1)})` });
  }
  if (checkIn.overallFatigue >= 4) weighted.push({ weight: 70, text: 'high fatigue' });
  if (checkIn.sleepQuality <= 2) weighted.push({ weight: 65, text: 'rough sleep' });
  if (sore.part) weighted.push({ weight: 50, text: `sore ${PART_LABEL[sore.part]}` });
  if (checkIn.motivation <= 2) weighted.push({ weight: 40, text: 'low motivation' });

  weighted.sort((a, b) => b.weight - a.weight);
  if (weighted.length > 0) return weighted.map((d) => d.text);
  // Nothing specific flagged: an honest positive note when green, neutral otherwise.
  return band === 'green'
    ? ['feeling fresh — good to push']
    : ['no single red flag — just a bit flat'];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
