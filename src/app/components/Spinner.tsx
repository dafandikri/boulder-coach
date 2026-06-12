import { HoldMark } from './HoldMark';

/** Branded full-screen loading state — a gently bobbing hold pebble. */
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <main
      className="flex flex-col items-center justify-center gap-3 p-10"
      style={{ minHeight: '60vh', color: 'var(--text-muted)' }}
    >
      <HoldMark color="sunshine" size={56} className="bc-bob" />
      <p style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{label}</p>
    </main>
  );
}
