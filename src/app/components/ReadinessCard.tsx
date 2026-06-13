import type { ReadinessBand, ReadinessResult } from '@/domain/readiness';
import { Card } from './Card';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';

/** Presentational readiness gauge (BC-28). Gate-blind by design — the band/score
 *  decisions live in the covered `computeReadiness`; this only maps a band to a
 *  colour and renders the score, bar, and the top 1–2 drivers. */
const BAND: Record<
  ReadinessBand,
  { tone: 'success' | 'warning' | 'danger'; fill: string; label: string }
> = {
  green: { tone: 'success', fill: 'var(--success)', label: 'Good to go' },
  amber: { tone: 'warning', fill: 'var(--warning)', label: 'Train smart' },
  red: { tone: 'danger', fill: 'var(--danger)', label: 'Ease off' },
};

export function ReadinessCard({ readiness }: { readiness: ReadinessResult }) {
  const band = BAND[readiness.band];
  return (
    <Card padding="sm">
      <div className="flex items-center justify-between gap-2">
        <span className="bc-eyebrow">Readiness</span>
        <Badge tone={band.tone} solid>
          {band.label}
        </Badge>
      </div>
      <div className="flex items-baseline gap-2" style={{ marginTop: 6 }}>
        <span className="bc-mono" style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>
          {readiness.score}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>/ 100</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <ProgressBar value={readiness.score} tone={band.fill} />
      </div>
      <p
        style={{
          marginTop: 8,
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-muted)',
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        {readiness.drivers.slice(0, 2).join(' · ')}
      </p>
    </Card>
  );
}
