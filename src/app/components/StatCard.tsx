import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** A single headline metric with a hold-colored icon chip, value, and label. */
export function StatCard({
  icon,
  value,
  label,
  sub,
  tone = 'var(--brand)',
}: {
  icon?: IconName;
  value: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        border: '2px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {icon ? (
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--r-md)',
            background: `color-mix(in srgb, ${tone} 18%, white)`,
            color: tone,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${tone}`,
          }}
        >
          <Icon name={icon} size={20} />
        </span>
      ) : null}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'var(--fs-2xl)',
          lineHeight: 1,
          color: 'var(--text)',
        }}
      >
        {value}
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
        {label}
      </div>
      {sub ? (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-soft)' }}>{sub}</div>
      ) : null}
    </div>
  );
}
