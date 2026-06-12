import Link from 'next/link';
import { Icon } from './Icon';

/** A back affordance for pushed (non-tab) screens. Defaults to Today. */
export function BackLink({ href = '/', label = 'Back' }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color: 'var(--text-muted)',
        fontWeight: 700,
        fontSize: 'var(--fs-sm)',
        textDecoration: 'none',
      }}
    >
      <Icon name="arrow-left" size={18} />
      {label}
    </Link>
  );
}
