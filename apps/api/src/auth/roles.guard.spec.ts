// Unit tests of RolesGuard (12.4, RN29): which roles open an endpoint marked @Roles.
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import type { Role } from './role.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(employee: AuthenticatedEmployee): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ employee }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: Role[] | undefined): RolesGuard {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  return new RolesGuard(reflector);
}

const employeeOnly: AuthenticatedEmployee = {
  employeeNumber: 2001,
  roles: ['empleado'],
  secondFactorVerified: false,
};

describe('RolesGuard', () => {
  it('lets any authenticated employee in when the endpoint has no @Roles', () => {
    const guard = guardRequiring(undefined);

    expect(guard.canActivate(contextFor(employeeOnly))).toBe(true);
  });

  it('RN29: lets in an employee holding one of the required roles among others', () => {
    const guard = guardRequiring(['aprobador', 'contaduria']);
    const approver: AuthenticatedEmployee = {
      employeeNumber: 2002,
      roles: ['empleado', 'aprobador'],
      secondFactorVerified: true,
    };

    expect(guard.canActivate(contextFor(approver))).toBe(true);
  });

  it('rejects with 403 an employee lacking every required role', () => {
    const guard = guardRequiring(['contaduria']);

    expect(() => guard.canActivate(contextFor(employeeOnly))).toThrow(
      ForbiddenException,
    );
  });

  it('says in the error which roles were needed and which the employee had', () => {
    const guard = guardRequiring(['contaduria']);

    expect(() => guard.canActivate(contextFor(employeeOnly))).toThrow(
      'Empleado 2001 sin rol permitido: necesita contaduria, tiene empleado',
    );
  });
});
