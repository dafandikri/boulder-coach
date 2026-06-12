import type { CSSProperties, ReactNode } from 'react';

/**
 * Base surface card — rounded, bordered, soft-shadowed. `feature` swaps to the
 * sticker look (ink border + solid pop). `accent` paints a thick top edge in a
 * hold color.
 */
export function Card({
  children,
  feature = false,
  accent,
  padding = 'md',
  className,
  style,
}: {
  children: ReactNode;
  feature?: boolean;
  accent?: string;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
}) {
  const pad = padding === 'sm' ? 14 : padding === 'lg' ? 24 : 18;
  return (
    <div
      className={className}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        border: feature ? '2px solid var(--basalt-900)' : '2px solid var(--border)',
        boxShadow: feature ? 'var(--pop-2)' : 'var(--shadow-sm)',
        padding: pad,
        ...(accent ? { borderTop: `6px solid ${accent}` } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
