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
