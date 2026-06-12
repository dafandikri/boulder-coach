/** A chunky rounded progress bar with an ink border and a hold-colored fill. */
export function ProgressBar({
  value = 0,
  max = 100,
  tone = 'var(--brand)',
  height = 14,
}: {
  value?: number;
  max?: number;
  tone?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      style={{
        height,
        background: 'var(--chalk-200)',
        borderRadius: 'var(--r-pill)',
        border: '2px solid var(--basalt-900)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: tone,
          borderRadius: 'var(--r-pill)',
          transition: 'width var(--dur-slow) var(--ease-out)',
        }}
      />
    </div>
  );
}
