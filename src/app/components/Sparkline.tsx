/**
 * BC-38 — a lightweight inline-SVG sparkline. No charting dependency (keeps the bundle
 * within the BC-36 budget). Presentational only: the series is built in the covered
 * `src/domain/insights.ts`; this component just maps numbers to a path.
 *
 * Accessibility: the whole figure is `role="img"` with a caller-supplied `ariaLabel`
 * describing the trend in words, so the meaning never depends on colour alone (BC-37).
 * An optional shaded `band` marks a healthy value range (e.g. ACWR 0.8–1.3).
 */
export interface SparklineBand {
  from: number;
  to: number;
  color?: string;
}

const VIEW_W = 100;

export function Sparkline({
  values,
  height = 48,
  stroke = 'var(--brand)',
  band,
  ariaLabel,
}: {
  values: number[];
  height?: number;
  stroke?: string;
  band?: SparklineBand;
  ariaLabel: string;
}) {
  // Scale across the data and the band bounds so the band is always visible.
  const bounds = band ? [...values, band.from, band.to] : values;
  const min = bounds.length > 0 ? Math.min(...bounds) : 0;
  const max = bounds.length > 0 ? Math.max(...bounds) : 1;
  const span = max - min || 1; // flat series → avoid divide-by-zero
  const y = (v: number) => height - ((v - min) / span) * height;
  const x = (i: number) => (values.length < 2 ? VIEW_W / 2 : (i / (values.length - 1)) * VIEW_W);

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${VIEW_W} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
    >
      {band && (
        <rect
          x={0}
          width={VIEW_W}
          y={y(band.to)}
          height={Math.abs(y(band.from) - y(band.to))}
          fill={band.color ?? 'var(--success)'}
          opacity={0.18}
        />
      )}
      {values.length >= 2 && (
        <path
          d={path.join(' ')}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
