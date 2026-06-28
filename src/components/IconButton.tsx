/**
 * IconButton — a small, reusable icon-only button used across the top bar
 * and pane headers. Renders the .icon-btn class with proper a11y.
 *
 * Accepts any lucide-react icon component. The icon is rendered at the
 * button's intrinsic size (controlled by CSS font-size / --icon-size in
 * styles.css), so callers only need to pick the component.
 */
import type { CSSProperties, MouseEventHandler } from 'react';
import type { LucideIcon } from 'lucide-react';

export type IconButtonProps = {
  /** lucide-react icon component, e.g. Settings, Sun, Moon. */
  icon: LucideIcon;
  /** Accessible label — also used as the native title unless `title` overrides. */
  label: string;
  /** Click handler. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Visual active state (adds .icon-btn--active). */
  active?: boolean;
  /** Optional tooltip override (defaults to `label`). */
  title?: string;
  /** Disable the button. */
  disabled?: boolean;
  /** Optional extra class names. */
  className?: string;
  /** Optional inline style passthrough. */
  style?: CSSProperties;
};

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  title,
  disabled = false,
  className,
  style,
}: IconButtonProps) {
  const classes = ['icon-btn'];
  if (active) classes.push('icon-btn--active');
  if (className) classes.push(className);
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-label={label}
      aria-pressed={active ? 'true' : 'false'}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      style={style}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

export default IconButton;
