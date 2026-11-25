// Start of the panel (/): opens the first screen the role may use, or explains there is none yet.
import { Navigate } from 'react-router';
import { useAuth } from '../../auth/AuthProvider.js';
import { PageHeader } from '../../components/PageHeader.js';
import { visibleNavigation } from '../shell/navigation.js';
import styles from './HomePage.module.css';

export function HomePage() {
  const { state } = useAuth();
  if (state.status !== 'signedIn') {
    return null;
  }
  // Until the Panel of UC-08 exists, the first screen of the role is the start page.
  const [firstScreen] = visibleNavigation(state.employee.roles);
  if (firstScreen !== undefined) {
    return <Navigate to={firstScreen.path} replace />;
  }
  return (
    <>
      <PageHeader eyebrow="Panel" title={`Hola, ${state.employee.fullName}.`} />
      <div className={styles.card}>
        <p>
          Todavía no hay pantallas del panel web para tu rol. Las solicitudes de viaje y las rendiciones se hacen desde
          la app móvil.
        </p>
      </div>
    </>
  );
}
