// Frame of every panel screen: dark sidebar with the screens the role may open, the user card and the content.
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../../auth/AuthProvider.js';
import type { EmployeeIdentity } from '../../auth/auth-api.js';
import { describeRoles } from '../../auth/role-names.js';
import { initialsOf } from '../approvals/approval-format.js';
import { useApprovalTray } from '../approvals/use-approvals.js';
import styles from './AppShell.module.css';
import { NavigationIcon } from './NavigationIcon.js';
import { visibleNavigation } from './navigation.js';

/** The approvals counter of the menu shares the tray's request (same TanStack Query key). */
function PendingCount({ employee }: { employee: EmployeeIdentity }) {
  const tray = useApprovalTray(employee.roles.includes('aprobador'));
  const count = tray.data?.length ?? 0;
  if (count === 0) {
    return null;
  }
  return (
    <span className={styles.count} aria-label={`${count} pendientes`}>
      {count}
    </span>
  );
}

function UserCard({ employee, onSignOut }: { employee: EmployeeIdentity; onSignOut: () => void }) {
  return (
    <div className={styles.user}>
      <div className={styles.who}>
        <div className={styles.avatar} aria-hidden="true">
          {initialsOf(employee.fullName)}
        </div>
        <div>
          <span className={styles.userName}>{employee.fullName}</span>
          <span className={styles.userDetail}>
            {employee.areaName} · {describeRoles(employee.roles)}
          </span>
        </div>
      </div>
      <button type="button" className={styles.signOut} onClick={onSignOut}>
        Cerrar sesión
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (state.status !== 'signedIn') {
    return null;
  }
  const { employee } = state;
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.link} ${styles.active}` : styles.link);

  return (
    <div className={styles.app}>
      <nav className={styles.sidebar} aria-label="Principal">
        <div className={styles.brandRow}>
          <div className={styles.logo}>
            <div className={styles.badge} aria-hidden="true">
              AMR
            </div>
            <div>
              <span className={styles.wordmark}>Viajes</span>
              <span className={styles.mutual}>MUTUAL AMR</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.menuToggle}
            aria-expanded={menuOpen}
            aria-controls="panel-menu"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
        <div id="panel-menu" className={menuOpen ? `${styles.menu} ${styles.menuOpen}` : styles.menu}>
          <ul className={styles.links}>
            {visibleNavigation(employee.roles).map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} className={linkClass} onClick={() => setMenuOpen(false)}>
                  <NavigationIcon icon={item.icon} />
                  {item.label}
                  {item.path === '/aprobaciones' && <PendingCount employee={employee} />}
                </NavLink>
              </li>
            ))}
          </ul>
          <UserCard employee={employee} onSignOut={() => void signOut()} />
        </div>
      </nav>
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
