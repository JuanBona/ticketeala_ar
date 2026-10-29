// Signs and checks the short-lived access token (JWT of D12, 15 minutes per D34).
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { isRole } from './role.js';

interface AccessTokenClaims {
  sub: string;
  roles: string[];
}

@Injectable()
export class AccessTokenService {
  constructor(private readonly jwtService: JwtService) {}

  /** Issues a token carrying the employee number and roles (D12). */
  sign(employee: AuthenticatedEmployee): Promise<string> {
    const claims: AccessTokenClaims = {
      sub: String(employee.employeeNumber),
      roles: employee.roles,
    };
    return this.jwtService.signAsync(claims);
  }

  /** Checks signature, algorithm and expiry, and rebuilds the employee it proves (D12). */
  async verify(token: string): Promise<AuthenticatedEmployee> {
    const claims = await this.readClaims(token);
    const employeeNumber = Number(claims.sub);
    if (!Number.isInteger(employeeNumber) || !Array.isArray(claims.roles)) {
      throw new UnauthorizedException(
        `JWT con datos inválidos: sub=${claims.sub}`,
      );
    }
    return { employeeNumber, roles: claims.roles.filter(isRole) };
  }

  private async readClaims(token: string): Promise<AccessTokenClaims> {
    try {
      return await this.jwtService.verifyAsync<AccessTokenClaims>(token);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UnauthorizedException(`JWT rechazado: ${reason}`);
    }
  }
}
