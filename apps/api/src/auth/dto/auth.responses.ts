// Response bodies of authentication (D12, D34, RN30), as classes so the OpenAPI contract can describe them.
import { ROLES, type Role } from '../role.js';
import { ApiProperty } from '@nestjs/swagger';

/** Tokens of a session: the access token goes in every request, the refresh token only renews it. */
export class TokenPair {
  /** JWT for `Authorization: Bearer …`; lasts 15 minutes (D34). */
  accessToken: string;
  /** Renews the pair at POST /auth/refresh; lasts 7 days and works only once (D34). */
  refreshToken: string;
  expiresInSeconds: number;
}

/** The three possible answers of step 1 of the Login screen (D12, RN30, D36). */
export const LOGIN_STEPS = [
  'authenticated',
  'totp_required',
  'totp_enrollment_required',
] as const;

/**
 * POST /auth/login. `authenticated` brings the tokens; the other two bring `challengeToken` for the
 * TOTP endpoints: `totp_required` → /auth/totp/verify, `totp_enrollment_required` → /auth/totp/enroll.
 */
export class LoginResponse {
  @ApiProperty({ enum: LOGIN_STEPS })
  step: (typeof LOGIN_STEPS)[number];
  /** Only with step `authenticated`. */
  accessToken?: string;
  /** Only with step `authenticated`. */
  refreshToken?: string;
  /** Only with step `authenticated`. */
  expiresInSeconds?: number;
  /** Only with the TOTP steps: valid for 5 minutes and only on /auth/totp/*. */
  challengeToken?: string;
}

/** GET /auth/me: who the access token belongs to, with the name and area the screens show. */
export class EmployeeIdentity {
  employeeNumber: number;
  fullName: string;
  /** Name of the employee's area (D15). */
  areaName: string;
  // Explicit: the plugin cannot read the values of the Role union type on its own.
  @ApiProperty({ enum: ROLES, isArray: true })
  roles: Role[];
  /** RN30: true when this session passed the TOTP code. */
  secondFactorVerified: boolean;
}
