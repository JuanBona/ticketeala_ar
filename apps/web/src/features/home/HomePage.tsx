// Temporary start page after login: who is signed in and how to leave. The real Panel (Main) comes next.
import { Button } from '../../components/Button.js';
import { useAuth } from '../../auth/AuthProvider.js';
import styles from './HomePage.module.css';

const ROLE_NAMES = {
  empleado: 'Empleado',
  aprobador: 'Aprobador',
  agencia: 'Asesor AMR Turismo',
  contaduria: 'Contaduría',
  gerencia: 'Gerencia',
  administrador: 'Administrador',
  auditor: 'Auditor',
} as const;

export function HomePage() {
  const { state, signOut } = useAuth();
  if (state.status !== 'signedIn') {
    return null;
  }
  const { employee } = state;
  return (
    <main className={styles.page}>
      <span className={styles.eyebrow}>AMR Viajes · Panel</span>
      <h1 className={styles.title}>Hola, legajo {employee.employeeNumber}.</h1>
      <section className={styles.card} aria-label="Tu sesión">
        <span className={styles.eyebrow}>Tus roles</span>
        <ul className={styles.roles}>
          {employee.roles.map((role) => (
            <li key={role} className={styles.role}>
              {ROLE_NAMES[role]}
            </li>
          ))}
        </ul>
        <p>{employee.secondFactorVerified ? 'Ingresaste con segundo factor.' : 'Ingresaste sin segundo factor.'}</p>
        <div className={styles.signOut}>
          <Button variant="dark" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </div>
      </section>
    </main>
  );
}
