// Closing note of the Login steps, as in the reference design.
import type { ReactNode } from 'react';
import styles from './LoginPage.module.css';

const DEFAULT_TEXT =
  'Acceso exclusivo para personal de la Mutual AMR. ¿Problemas para ingresar? Contactá a la Gerencia de Tecnologías y Procesos.';

export function LoginFootnote({ children = DEFAULT_TEXT }: { children?: ReactNode }) {
  return <p className={styles.footnote}>{children}</p>;
}
