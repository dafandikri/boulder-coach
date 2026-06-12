import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'grape';

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: 'var(--chalk-200)', fg: 'var(--text)', bd: 'var(--chalk-300)' },
  brand: { bg: 'var(--brand-tint)', fg: 'var(--brand-deep)', bd: 'var(--brand)' },
  success: { bg: 'var(--success-tint)', fg: 'var(--success-deep)', bd: 'var(--success)' },
  warning: { bg: 'var(--warning-tint)', fg: 'var(--warning-deep)', bd: 'var(--warning)' },
  danger: { bg: 'var(--danger-tint)', fg: 'var(--danger-deep)', bd: 'var(--danger)' },
  info: { bg: 'var(--info-tint)', fg: 'var(--info-deep)', bd: 'var(--info)' },
  grape: { bg: 'var(--hold-grape-tint)', fg: 'var(--hold-grape-deep)', bd: 'var(--hold-grape)' },
};

/** Small status pill. Soft tinted fill, colored text, hairline border. */
export function Badge({
  children,
  tone = 'neutral',
  icon,
  solid = false,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: IconName;
  solid?: boolean;
}) {
  const t = TONES[tone];
  const skin = solid
    ? { background: t.fg, color: '#fff', border: '2px solid transparent' }
    : { background: t.bg, color: t.fg, border: `2px solid ${t.bd}` };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 11px',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-body)',
        fontWeight: 800,
        fontSize: 'var(--fs-xs)',
        letterSpacing: '0.01em',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        ...skin,
      }}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}
