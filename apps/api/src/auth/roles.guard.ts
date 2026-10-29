// Global guard (12.4): an endpoint marked @Roles admits only employees holding one of those roles.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './authenticated-employee.js';
import { ROLES_KEY } from './decorators.js';
import type { Role } from './role.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /** Roles come from the signed token, never from the client's request body (12.4). */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const { employee } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const heldRoles = employee?.roles ?? [];
    if (heldRoles.some((role) => requiredRoles.includes(role))) {
      return true;
    }
    throw new ForbiddenException(
      `Empleado ${employee?.employeeNumber} sin rol permitido: necesita ${requiredRoles.join(' o ')}, tiene ${heldRoles.join(', ') || 'ninguno'}`,
    );
  }
}
