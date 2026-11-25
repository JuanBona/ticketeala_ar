// Top of every panel screen: today's date, the title and one line about what the screen is for.
import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

const todayFormat = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

/** "mié 25 nov 2026" (the eyebrow style turns it uppercase). */
export function formatToday(today: Date): string {
  return todayFormat.format(today).replace(/[.,]/g, '');
}

export function PageHeader({ title, eyebrow, children }: { title: string; eyebrow: string; children?: ReactNode }) {
  return (
    <header className={styles.header}>
      <span className={styles.eyebrow}>
        {formatToday(new Date())} · {eyebrow}
      </span>
      <h1 className={styles.title}>{title}</h1>
      {children !== undefined && <p className={styles.lead}>{children}</p>}
    </header>
  );
}
