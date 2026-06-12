// V-grade → hold color. Cycles through the rainbow so each grade reads distinctly.
const GRADE_COLORS = [
  'var(--hold-lime)', // V0/V1
  'var(--hold-lime)',
  'var(--hold-teal)', // V2
  'var(--hold-sky)', // V3
  'var(--hold-sky)', // V4
  'var(--hold-grape)', // V5
  'var(--hold-grape)', // V6
  'var(--hold-pink)', // V7
  'var(--hold-pink)', // V8
  'var(--hold-tangerine)', // V9
  'var(--hold-red)', // V10+
];

function colorFor(grade: number): string {
  const i = Math.max(0, Math.min(GRADE_COLORS.length - 1, grade));
  return GRADE_COLORS[i] ?? 'var(--hold-lime)';
}

/** A V-scale grade chip in the mono face, tinted to the grade's hold color. */
export function GradePill({
  grade,
  size = 'md',
  filled = false,
}: {
  grade: number;
  size?: 'sm' | 'md' | 'lg';
  filled?: boolean;
}) {
  const c = colorFor(grade);
  const dims =
    size === 'sm'
      ? { font: 'var(--fs-xs)', pad: '2px 8px' }
      : size === 'lg'
        ? { font: 'var(--fs-lg)', pad: '6px 16px' }
        : { font: 'var(--fs-sm)', pad: '4px 12px' };
  const skin = filled
    ? { background: c, color: '#fff', border: '2px solid var(--basalt-900)' }
    : { background: 'var(--surface)', color: 'var(--text)', border: `2px solid ${c}` };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        borderRadius: 'var(--r-pill)',
        lineHeight: 1.2,
        fontSize: dims.font,
        padding: dims.pad,
        ...skin,
      }}
    >
      V{grade}
    </span>
  );
}
