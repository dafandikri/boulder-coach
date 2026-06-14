// Plain-language explainers for the two metrics climbers ask about most: RPE (how
// hard a session felt) and ACWR (whether load is ramping safely). The band selection
// and personalised copy are the testable logic, kept here in a covered lib so the
// gate-blind UI only renders them (universal-quality-bar §2). Thresholds mirror the
// adaptation engine: caution >= 1.3 (rule 4), high > 1.5 (rule 3).

export interface Explainer {
  heading: string;
  body: string;
}

export type AcwrBand = 'no-data' | 'detraining' | 'sweet' | 'caution' | 'high';

export interface AcwrExplainer extends Explainer {
  band: AcwrBand;
}

export function acwrBand(acwr: number): AcwrBand {
  if (acwr === 0) return 'no-data';
  if (acwr > 1.5) return 'high';
  if (acwr >= 1.3) return 'caution';
  if (acwr < 0.8) return 'detraining';
  return 'sweet';
}

const ACWR_DEFINITION =
  'ACWR (Acute:Chronic Workload Ratio) compares this week’s training load to your ~4-week average. ' +
  'Load = how hard × how long. The 0.8–1.3 band is the sweet spot for getting stronger without spiking injury risk.';

const ACWR_READ: Record<AcwrBand, (acwr: number) => string> = {
  'no-data': () =>
    'Log a few sessions and this will start tracking whether your load is ramping safely.',
  detraining: (a) =>
    `Yours is ${a} — below the sweet spot. Load has dipped; there’s room to build back up gradually.`,
  sweet: (a) =>
    `Yours is ${a} — right in the sweet spot. Keep the steady, progressive build going.`,
  caution: (a) =>
    `Yours is ${a} — load is creeping up. The coach holds intensity steady (no new max attempts) until it settles.`,
  high: (a) =>
    `Yours is ${a} — load is spiking faster than your body has adapted to. The coach eases off to keep you off the injury list.`,
};

export function explainAcwr(acwr: number): AcwrExplainer {
  const band = acwrBand(acwr);
  return {
    band,
    heading: 'What is ACWR?',
    body: `${ACWR_DEFINITION} ${ACWR_READ[band](acwr)}`,
  };
}

export interface RpeStop {
  value: number;
  label: string;
}

/** Anchor points on the 1–10 Borg-style RPE (Rate of Perceived Exertion) scale. */
export const RPE_SCALE: RpeStop[] = [
  { value: 1, label: 'Very easy' },
  { value: 3, label: 'Easy' },
  { value: 5, label: 'Moderate' },
  { value: 7, label: 'Hard' },
  { value: 9, label: 'Very hard' },
  { value: 10, label: 'Max effort' },
];

export function explainRpe(): Explainer {
  return {
    heading: 'What is RPE?',
    body:
      'RPE (Rate of Perceived Exertion) is how hard a session or a climb felt, 1–10. ' +
      '1 is a stroll, 10 is an all-out effort you couldn’t repeat. Logging it honestly lets the coach ' +
      'track your real load and dial intensity up or down — guessing high every time just makes it back you off.',
  };
}
