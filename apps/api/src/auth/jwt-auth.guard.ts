// Global guard (D12, RN30): every endpoint needs a valid access token unless it is marked @Public.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenService } from './access-token.service.js';
import type { AuthenticatedRequest } from './authenticated-employee.js';
import { IS_PUBLIC_KEY } from './decorators.js';
import { requiresSecondFactor } from './role.js';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public can be on the method or on the whole controller; the method wins.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // The client sends `Authorization: Bearer <token>`; anything else is a 401.
    const token = readBearerToken(request.headers.authorization);
    const employee = await this.accessTokens.verify(token);
    // RN30: login never issues such a token; refusing it here also guards against a future bug there.
    if (
      requiresSecondFactor(employee.roles) &&
      !employee.secondFactorVerified
    ) {
      throw new UnauthorizedException(
        `Empleado ${employee.employeeNumber} necesita segundo factor para sus roles (RN30)`,
      );
    }
    // From here on, @CurrentEmployee and RolesGuard read who is calling from the request.
    request.employee = employee;
    return true;
  }
}

function readBearerToken(header: string | undefined): string {
  if (!header?.startsWith(BEARER_PREFIX)) {
    throw new UnauthorizedException(
      'Falta el encabezado Authorization: Bearer <token>',
    );
  }
  return header.slice(BEARER_PREFIX.length);
}
