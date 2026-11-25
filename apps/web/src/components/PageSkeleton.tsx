// Placeholder shown while the saved session is restored, instead of a blank page.
import styles from './PageSkeleton.module.css';

export function PageSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Cargando">
      <div className={styles.title} />
      <div className={styles.card} />
      <div className={styles.card} />
    </div>
  );
}
