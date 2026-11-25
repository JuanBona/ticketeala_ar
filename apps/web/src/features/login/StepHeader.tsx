// Eyebrow, title and lead of each Login step; the title is where focus lands when the step changes.
import type { ReactNode } from 'react';
import styles from './LoginPage.module.css';

export function StepHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className={styles.head}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h1 className={styles.title} tabIndex={-1}>
        {title}
      </h1>
      {children !== undefined && <p className={styles.lead}>{children}</p>}
    </div>
  );
}
