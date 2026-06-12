export type HoldColor =
  | 'red'
  | 'tangerine'
  | 'sunshine'
  | 'lime'
  | 'teal'
  | 'sky'
  | 'grape'
  | 'pink';

/**
 * The brand's signature graphic: a colorful climbing-hold pebble. Rendered as a
 * CSS background (no <img>, no layout shift) for decoration, empty states, and
 * category dots. Decorative only — always aria-hidden.
 */
export function HoldMark({
  color = 'red',
  size = 48,
  rotate = 0,
  className,
}: {
  color?: HoldColor;
  size?: number;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundImage: `url(/holds/hold-${color}.svg)`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        flex: 'none',
      }}
    />
  );
}
