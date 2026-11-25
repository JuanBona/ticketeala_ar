// Alert message: ink on the alert color (AA), with an icon so it does not depend on color alone.
import type { ReactNode } from 'react';
import styles from './Alert.module.css';

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className={styles.alert} role="alert">
      <span className={styles.icon} aria-hidden="true">
        !
      </span>
      <span>{children}</span>
    </div>
  );
}
