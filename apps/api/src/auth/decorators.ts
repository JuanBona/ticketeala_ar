// Endpoint decorators for authentication (D12): @Public, @Roles and @CurrentEmployee.
import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type {
  AuthenticatedEmployee,
  AuthenticatedRequest,
} from './authenticated-employee.js';
import type { Role } from './role.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** Opens an endpoint without an access token. Every other endpoint requires one. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts an endpoint to employees holding at least one of these roles (D07, RN29). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the employee proven by the access token. */
export const CurrentEmployee = createParamDecorator(
  (_unused: unknown, context: ExecutionContext): AuthenticatedEmployee => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.employee) {
      throw new Error(
        `Endpoint sin empleado autenticado: ${request.method} ${request.url} es @Public`,
      );
    }
    return request.employee;
  },
);
