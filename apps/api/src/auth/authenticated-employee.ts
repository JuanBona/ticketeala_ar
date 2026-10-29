// Who is calling: the identity the access token proves, attached to the request by JwtAuthGuard.
import type { Request } from 'express';
import type { Role } from './role.js';
import type { SecondFactorChallenge } from './second-factor-challenge.service.js';

export interface AuthenticatedEmployee {
  employeeNumber: number;
  roles: Role[];
  /** RN30: true when this session was opened with a valid TOTP code. */
  secondFactorVerified: boolean;
}

export interface AuthenticatedRequest extends Request {
  employee?: AuthenticatedEmployee;
  /** Set by SecondFactorChallengeGuard on POST /auth/totp/verify. */
  secondFactorChallenge?: SecondFactorChallenge;
}
