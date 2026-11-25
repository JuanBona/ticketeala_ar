// How each role of D07 reads on screen.
import type { Role } from './auth-api.js';

export const ROLE_NAMES: Record<Role, string> = {
  empleado: 'Empleado',
  aprobador: 'Aprobador',
  agencia: 'Asesor AMR Turismo',
  contaduria: 'Contaduría',
  gerencia: 'Gerencia',
  administrador: 'Administrador',
  auditor: 'Auditor',
};

/** The employee role is implicit for almost everyone, so the panel names the others first. */
export function describeRoles(roles: readonly Role[]): string {
  const specific = roles.filter((role) => role !== 'empleado');
  return (specific.length > 0 ? specific : roles).map((role) => ROLE_NAMES[role]).join(' · ');
}
