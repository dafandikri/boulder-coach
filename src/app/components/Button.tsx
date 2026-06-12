import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

/**
 * Primary brand button — chunky, rounded, with the signature sticker "pop"
 * (solid offset + ink border) that drops onto its shadow when pressed. All
 * visual states live in the global `.bc-btn` rules; this only composes classes.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  className,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    'bc-btn',
    size !== 'md' ? `bc-btn--${size}` : '',
    variant !== 'primary' ? `bc-btn--${variant}` : '',
    fullWidth ? 'bc-btn--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const glyph = size === 'lg' ? 22 : 19;
  return (
    <button className={cls} {...rest}>
      {icon ? <Icon name={icon} size={glyph} /> : null}
      {children ? <span>{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={glyph} /> : null}
    </button>
  );
}
