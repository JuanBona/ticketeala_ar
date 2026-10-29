// Unit tests of RN30 with RN29: which role combinations require the TOTP second factor.
import { requiresSecondFactor, type Role } from './role.js';

describe('requiresSecondFactor', () => {
  it.each(['aprobador', 'contaduria', 'administrador'] as const)(
    'RN30: %s requires a second factor',
    (role) => {
      expect(requiresSecondFactor([role])).toBe(true);
    },
  );

  it.each(['empleado', 'agencia', 'gerencia', 'auditor'] as const)(
    'RN30: %s alone does not require a second factor',
    (role) => {
      expect(requiresSecondFactor([role])).toBe(false);
    },
  );

  it('RN29: one RN30 role among others is enough to require it', () => {
    const roles: Role[] = ['empleado', 'gerencia', 'contaduria'];

    expect(requiresSecondFactor(roles)).toBe(true);
  });
});
