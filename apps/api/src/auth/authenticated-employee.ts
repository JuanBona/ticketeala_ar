// Who is calling: the identity the access token proves, attached to the request by JwtAuthGuard.
import type { Request } from 'express';
import type { Role } from './role.js';

export interface AuthenticatedEmployee {
  employeeNumber: number;
  roles: Role[];
}

export interface AuthenticatedRequest extends Request {
  employee?: AuthenticatedEmployee;
}
