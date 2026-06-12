import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/** Selectable pill (filter / multi-select / toggle). Coral when active. */
export function Chip({
  children,
  selected = false,
  icon,
  onClick,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  selected?: boolean;
  icon?: IconName;
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      className={['bc-chip', className ?? ''].filter(Boolean).join(' ')}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
