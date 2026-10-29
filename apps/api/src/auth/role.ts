// Role names stored in the `rol` table (D07); an employee can hold several at once (RN29).
export const ROLES = [
  'empleado',
  'aprobador',
  'agencia',
  'contaduria',
  'gerencia',
  'administrador',
  'auditor',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(name: string): name is Role {
  return (ROLES as readonly string[]).includes(name);
}

/** RN30: roles that must pass a second factor (TOTP) at every login. */
export const SECOND_FACTOR_ROLES: readonly Role[] = [
  'aprobador',
  'contaduria',
  'administrador',
];

/** RN30 with RN29: holding any one of these roles, among others, is enough to require TOTP. */
export function requiresSecondFactor(roles: readonly Role[]): boolean {
  return roles.some((role) => SECOND_FACTOR_ROLES.includes(role));
}
