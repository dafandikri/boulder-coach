'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: '/', icon: 'house', label: 'Today' },
  { href: '/insights', icon: 'trending-up', label: 'Insights' },
  { href: '/program', icon: 'calendar-check', label: 'Program' },
  { href: '/drills', icon: 'dumbbell', label: 'Drills' },
  { href: '/profile', icon: 'user', label: 'You' },
];

/**
 * Persistent bottom tab bar (BC-11). Thumb-reachable, fixed within the mobile
 * column. Pushed flows (/checkin, /session, /exercises, /history) read as the
 * Today tab, matching the design-system kit.
 */
export function BottomNav() {
  const pathname = usePathname();
  const activeOther = TABS.slice(1).find((t) => pathname.startsWith(t.href));
  const activeHref = activeOther?.href ?? '/';

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 'var(--app-max)',
        display: 'flex',
        borderTop: '2px solid var(--border)',
        background: 'var(--surface)',
        padding: '8px 6px calc(10px + env(safe-area-inset-bottom))',
        zIndex: 20,
      }}
    >
      {TABS.map((t) => {
        const on = t.href === activeHref;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '4px 0',
              textDecoration: 'none',
              color: on ? 'var(--brand)' : 'var(--text-soft)',
              fontWeight: 800,
              fontSize: 10,
              fontFamily: 'var(--font-body)',
            }}
          >
            <Icon name={t.icon} size={22} strokeWidth={on ? 2.6 : 2.1} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
