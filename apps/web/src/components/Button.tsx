// Button of the alto-contraste style: primary (lime, hard shadow), dark, secondary and link.
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'link';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  /** While a request is running: disabled, with a spinner, and announced to screen readers. */
  busy?: boolean;
}

export function Button({ variant, busy = false, disabled, children, type = 'button', className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
      disabled={disabled === true || busy}
      aria-busy={busy}
    >
      {busy && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
