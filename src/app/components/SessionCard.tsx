import type { ReactNode } from 'react';
import type { SessionType } from '@/domain/types';
import { Icon, type IconName } from './Icon';

const SESSION: Record<SessionType, { color: string; label: string; icon: IconName }> = {
  'limit-boulder': { color: 'var(--session-limit)', label: 'Limit boulder', icon: 'flame' },
  'power-endurance': { color: 'var(--session-power)', label: 'Power-endurance', icon: 'zap' },
  'volume-technique': { color: 'var(--session-volume)', label: 'Volume-technique', icon: 'waves' },
  'antagonist-prehab': {
    color: 'var(--session-prehab)',
    label: 'Antagonist-prehab',
    icon: 'shield',
  },
  rest: { color: 'var(--session-rest)', label: 'Rest day', icon: 'moon' },
};

/**
 * The signature "today's session" card. A hold-colored left rail keys the
 * session type; a type badge + title + meta sit up top; children hold the
 * actions / block list.
 */
export function SessionCard({
  type,
  title,
  meta,
  children,
}: {
  type: SessionType;
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  const s = SESSION[type];
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        border: '2px solid var(--basalt-900)',
        boxShadow: 'var(--pop-2)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{ position: 'absolute', insetBlock: 0, left: 0, width: 8, background: s.color }}
      />
      <div style={{ padding: '18px 20px 18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 'var(--r-pill)',
              background: `color-mix(in srgb, ${s.color} 16%, white)`,
              color: `color-mix(in srgb, ${s.color} 75%, black)`,
              border: `2px solid ${s.color}`,
              fontWeight: 800,
              fontSize: 'var(--fs-xs)',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={s.icon} size={14} />
            {s.label}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'var(--fs-xl)',
            lineHeight: 1.1,
            color: 'var(--text)',
          }}
        >
          {title}
        </div>
        {meta ? (
          <div
            style={{
              marginTop: 4,
              fontWeight: 700,
              fontSize: 'var(--fs-sm)',
              color: 'var(--text-muted)',
            }}
          >
            {meta}
          </div>
        ) : null}
        {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
      </div>
    </div>
  );
}
