// Screens of the web panel and who may open each one ("lo que el usuario no puede hacer no se muestra").
import type { Role } from '../../auth/auth-api.js';

export interface NavigationItem {
  path: string;
  label: string;
  /** Any of these roles opens the screen; the API checks it again on every endpoint (RN29). */
  roles: readonly Role[];
  icon: 'inbox';
}

/** Only screens that exist. The rest of docs/pantallas.md joins this list as each one is built. */
export const NAVIGATION: readonly NavigationItem[] = [
  { path: '/aprobaciones', label: 'Aprobaciones', roles: ['aprobador'], icon: 'inbox' },
];

export function visibleNavigation(roles: readonly Role[]): NavigationItem[] {
  return NAVIGATION.filter((item) => item.roles.some((role) => roles.includes(role)));
}
