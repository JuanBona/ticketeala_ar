// Dark left half of the Login: the welcome message, or the progress of the TOTP setup (D36).
import styles from './LoginPage.module.css';

const WELCOME_POINTS = [
  'Pedís el viaje y se aprueba en horas, no en días.',
  'Cargás cada ticket con una foto.',
  'Rendís y el saldo se calcula solo.',
];

const SETUP_POINTS = [
  'Código de habilitación que te dio un Administrador.',
  'Escaneás el QR con tu app de autenticación.',
  'Guardás tus códigos de recuperación.',
];

export type SetupProgress = 0 | 1 | 2;

function pointState(index: number, current: SetupProgress | undefined): 'done' | 'current' | 'pending' {
  if (current === undefined || index === current) return 'current';
  return index < current ? 'done' : 'pending';
}

const STATE_LABEL = { done: 'Hecho', current: 'Paso actual', pending: 'Pendiente' } as const;

/** Without setupProgress it shows the welcome; with it, the three setup steps and which one is current. */
export function BrandPanel({ setupProgress }: { setupProgress?: SetupProgress | undefined }) {
  const inSetup = setupProgress !== undefined;
  const points = inSetup ? SETUP_POINTS : WELCOME_POINTS;
  return (
    <section className={styles.brand} aria-label="AMR Viajes">
      <div className={styles.logo}>
        <div className={styles.badge} aria-hidden="true">
          AMR
        </div>
        <span className={styles.wordmark}>Viajes</span>
      </div>
      <p className={styles.hero} key={inSetup ? 'setup' : 'welcome'}>
        {inSetup ? 'Tu cuenta, ' : 'Viajes y rendiciones, '}
        <span className={styles.highlight}>{inSetup ? 'con doble llave.' : 'sin papel.'}</span>
      </p>
      <ol className={styles.points}>
        {points.map((text, index) => {
          const state = pointState(index, setupProgress);
          return (
            <li key={text} className={`${styles.point} ${state === 'current' ? '' : styles[state]}`}>
              <span className={styles.pointNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className={styles.pointText}>
                {inSetup && <span className={styles.visuallyHidden}>{STATE_LABEL[state]}: </span>}
                {text}
              </span>
            </li>
          );
        })}
      </ol>
      <span className={styles.place}>MUTUAL AMR · ROSARIO</span>
    </section>
  );
}
