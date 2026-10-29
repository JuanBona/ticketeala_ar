// Signs and checks the short-lived access token (JWT of D12, 15 minutes per D34).
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_AUDIENCE } from './auth.constants.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { isRole } from './role.js';

interface AccessTokenClaims {
  sub: string;
  roles: string[];
  secondFactorVerified: boolean;
}

@Injectable()
export class AccessTokenService {
  constructor(private readonly jwtService: JwtService) {}

  /** Issues a token carrying the employee number, roles and whether TOTP was passed (D12, RN30). */
  sign(employee: AuthenticatedEmployee): Promise<string> {
    const claims: AccessTokenClaims = {
      sub: String(employee.employeeNumber),
      roles: employee.roles,
      secondFactorVerified: employee.secondFactorVerified,
    };
    return this.jwtService.signAsync(claims, {
      audience: ACCESS_TOKEN_AUDIENCE,
    });
  }

  /** Checks signature, algorithm, audience and expiry, and rebuilds the employee it proves (D12). */
  async verify(token: string): Promise<AuthenticatedEmployee> {
    const claims = await this.readClaims(token);
    // `sub` (subject) carries the employee number as text, as the JWT standard asks.
    const employeeNumber = Number(claims.sub);
    if (!Number.isInteger(employeeNumber) || !Array.isArray(claims.roles)) {
      throw new UnauthorizedException(
        `JWT con datos inválidos: sub=${claims.sub}`,
      );
    }
    return {
      employeeNumber,
      // Unknown role names are dropped, so a typo never grants anything.
      roles: claims.roles.filter(isRole),
      secondFactorVerified: claims.secondFactorVerified === true,
    };
  }

  private async readClaims(token: string): Promise<AccessTokenClaims> {
    try {
      // Checks signature, algorithm, expiry and that the audience is the access one.
      return await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        audience: ACCESS_TOKEN_AUDIENCE,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UnauthorizedException(`JWT rechazado: ${reason}`);
    }
  }
}
