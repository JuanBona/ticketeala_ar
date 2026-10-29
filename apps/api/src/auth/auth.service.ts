// Login, refresh and logout (D12, D34): checks the password with argon2 and hands out the token pair.
import { randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessTokenService } from './access-token.service.js';
import { ACCESS_TOKEN_LIFETIME_SECONDS } from './auth.constants.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { RefreshSessionService } from './refresh-session.service.js';
import { isRole } from './role.js';

/** Same message for unknown email and wrong password, so nobody can probe which emails exist. */
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const PLACEHOLDER_PASSWORD_BYTES = 32;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

interface ActiveEmployee extends AuthenticatedEmployee {
  passwordHash: string;
}

@Injectable()
export class AuthService {
  /** Checked when the email does not exist, so both failures take the same argon2 time. */
  private readonly placeholderHash = argon2.hash(
    randomBytes(PLACEHOLDER_PASSWORD_BYTES),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshSessions: RefreshSessionService,
  ) {}

  /** D12: only active employees (RN28) with the right password get a session. */
  async login(email: string, password: string): Promise<TokenPair> {
    const employee = await this.findActiveEmployee({ email });
    const storedHash = employee?.passwordHash ?? (await this.placeholderHash);
    const passwordMatches = await argon2.verify(storedHash, password);
    if (!employee || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const refreshToken = await this.refreshSessions.start(
      employee.employeeNumber,
    );
    return this.buildTokenPair(employee, refreshToken);
  }

  /** D34: rotates the refresh token and reloads roles, so role changes apply at the next refresh. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const rotated = await this.refreshSessions.rotate(refreshToken);
    const employee = await this.findActiveEmployee({
      employeeNumber: rotated.employeeNumber,
    });
    if (!employee) {
      await this.refreshSessions.revokeFamily(rotated.familyId);
      throw new UnauthorizedException(
        `Empleado ${rotated.employeeNumber} dado de baja: se cerró su sesión`,
      );
    }
    return this.buildTokenPair(employee, rotated.refreshToken);
  }

  /** D34: logout revokes the session family of this refresh token. */
  logout(refreshToken: string): Promise<void> {
    return this.refreshSessions.revoke(refreshToken);
  }

  private async buildTokenPair(
    employee: AuthenticatedEmployee,
    refreshToken: string,
  ): Promise<TokenPair> {
    const accessToken = await this.accessTokens.sign({
      employeeNumber: employee.employeeNumber,
      roles: employee.roles,
    });
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: ACCESS_TOKEN_LIFETIME_SECONDS,
    };
  }

  private async findActiveEmployee(
    criteria: { email: string } | { employeeNumber: number },
  ): Promise<ActiveEmployee | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { ...criteria, active: true },
      include: { roles: { include: { role: true } } },
    });
    if (!employee) {
      return null;
    }
    return {
      employeeNumber: employee.employeeNumber,
      passwordHash: employee.passwordHash,
      roles: employee.roles.map((grant) => grant.role.name).filter(isRole),
    };
  }
}
