import type { ComponentProps, ReactNode } from 'react';
import { formatGrade } from '@/domain/grade';
import type { Block } from '@/domain/types';
import { Badge } from './Badge';

type BadgeTone = ComponentProps<typeof Badge>['tone'];

/**
 * BC-54: the single source of truth for rendering a block's descriptive header —
 * name + category badge + target line + one-line `notes` summary — reused by Today,
 * the session player, and the program preview. Before this, a `Block` was rendered
 * three different ways and `notes` was shown on Today but silently dropped in the
 * other two (the root cause of BC-52). Routing all three through this component
 * means a surface can never again show *less* than another.
 *
 * Presentational only (gate-blind by design): no business logic. `leading` carries
 * the warm-up checkbox; `children` carry each surface's extras (the collapsible
 * how-to or the logging form). `showGrade` is false on Today, which renders the
 * grade as a separate `GradePill` instead of inline.
 */
export function BlockSummary({
  block,
  badgeTone = 'neutral',
  badgeLabel,
  leading,
  showGrade = true,
  children,
}: {
  block: Block;
  badgeTone?: BadgeTone;
  badgeLabel?: string;
  leading?: ReactNode;
  showGrade?: boolean;
  children?: ReactNode;
}) {
  const heading = (
    <>
      {leading}
      <span style={{ fontWeight: 800, fontSize: 'var(--fs-md)' }}>{block.name}</span>
    </>
  );
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        {/* A <label> only when there's a control (the warm-up checkbox) to associate
            with — otherwise a plain <span>, to avoid an empty-label a11y violation. */}
        {leading ? (
          <label className="flex items-start gap-2" style={{ minWidth: 0 }}>
            {heading}
          </label>
        ) : (
          <span className="flex items-start gap-2" style={{ minWidth: 0 }}>
            {heading}
          </span>
        )}
        <Badge tone={badgeTone}>{badgeLabel ?? block.category}</Badge>
      </div>
      <p
        style={{
          marginTop: 4,
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-muted)',
          fontWeight: 600,
        }}
      >
        {block.sets} × {block.grip}
        {showGrade && block.targetGrade !== undefined
          ? ` · ${formatGrade(block.targetGrade)}`
          : ''}{' '}
        · RPE {block.targetRPE}
      </p>
      {block.notes ? (
        <p style={{ marginTop: 3, fontSize: 'var(--fs-xs)', color: 'var(--text-soft)' }}>
          {block.notes}
        </p>
      ) : null}
      {children}
    </>
  );
}
