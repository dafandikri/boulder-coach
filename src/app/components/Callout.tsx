import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'brand';

const TONES: Record<Tone, { bg: string; fg: string; bd: string; icon: IconName }> = {
  info: { bg: 'var(--info-tint)', fg: 'var(--info-deep)', bd: 'var(--info)', icon: 'info' },
  success: {
    bg: 'var(--success-tint)',
    fg: 'var(--success-deep)',
    bd: 'var(--success)',
    icon: 'check-circle',
  },
  warning: {
    bg: 'var(--warning-tint)',
    fg: 'var(--warning-deep)',
    bd: 'var(--warning)',
    icon: 'triangle-alert',
  },
  danger: {
    bg: 'var(--danger-tint)',
    fg: 'var(--danger-deep)',
    bd: 'var(--danger)',
    icon: 'alert-octagon',
  },
  brand: { bg: 'var(--brand-tint)', fg: 'var(--brand-deep)', bd: 'var(--brand)', icon: 'sparkles' },
};

/** Inline message banner — the app's "explain the why" + safety notices. */
export function Callout({
  tone = 'info',
  title,
  children,
  icon,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
}) {
  const t = TONES[tone];
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 'var(--r-md)',
        background: t.bg,
        border: `2px solid ${t.bd}`,
        color: t.fg,
      }}
    >
      <span style={{ flex: 'none', marginTop: 1 }}>
        <Icon name={icon ?? t.icon} size={19} />
      </span>
      <div style={{ minWidth: 0 }}>
        {title ? <div style={{ fontWeight: 800, fontSize: 'var(--fs-sm)' }}>{title}</div> : null}
        {children ? (
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.45 }}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
