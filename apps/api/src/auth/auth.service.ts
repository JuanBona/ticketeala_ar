// Login in one or two steps (D12, RN30), refresh and logout (D34): argon2 password, then TOTP if the role needs it.
import { randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessTokenService } from './access-token.service.js';
import { ACCESS_TOKEN_LIFETIME_SECONDS } from './auth.constants.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { RefreshSessionService } from './refresh-session.service.js';
import { isRole, requiresSecondFactor, type Role } from './role.js';
import {
  SecondFactorChallengeService,
  type SecondFactorChallenge,
} from './second-factor-challenge.service.js';
import { TotpService } from './totp.service.js';

/** Same message for unknown email and wrong password, so nobody can probe which emails exist. */
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const PLACEHOLDER_PASSWORD_BYTES = 32;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/** What step 1 of the Login screen leads to: in, TOTP code, or first TOTP setup with its QR. */
export type LoginResult =
  | ({ step: 'authenticated' } & TokenPair)
  | { step: 'totp_required'; challengeToken: string }
  | {
      step: 'totp_enrollment_required';
      challengeToken: string;
      otpauthUri: string;
    };

interface ActiveEmployee {
  employeeNumber: number;
  email: string;
  passwordHash: string;
  roles: Role[];
  hasSecondFactor: boolean;
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
    private readonly challenges: SecondFactorChallengeService,
    private readonly totp: TotpService,
  ) {}

  /** D12, RN28, RN30: right password and active employee; RN30 roles still owe a TOTP code. */
  async login(email: string, password: string): Promise<LoginResult> {
    const employee = await this.checkPassword(email, password);
    if (requiresSecondFactor(employee.roles)) {
      return this.challengeSecondFactor(employee);
    }
    const tokens = await this.openSession({
      employeeNumber: employee.employeeNumber,
      roles: employee.roles,
      secondFactorVerified: false,
    });
    return { step: 'authenticated', ...tokens };
  }

  /** RN30: step 2 of the login; at first enrollment the code also confirms the new secret. */
  async completeSecondFactor(
    challenge: SecondFactorChallenge,
    code: string,
  ): Promise<TokenPair> {
    const { employeeNumber, enrollmentSecret } = challenge;
    const employee = await this.findActiveEmployee({ employeeNumber });
    if (!employee) {
      throw new UnauthorizedException(
        `Empleado ${employeeNumber} dado de baja`,
      );
    }
    if (enrollmentSecret) {
      await this.totp.confirmEnrollment(employeeNumber, enrollmentSecret, code);
    } else {
      await this.totp.verifyCode(employeeNumber, code);
    }
    return this.openSession({
      employeeNumber,
      roles: employee.roles,
      secondFactorVerified: true,
    });
  }

  /** D34: rotates the refresh token and reloads roles, so role changes apply at the next refresh. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const rotated = await this.refreshSessions.rotate(refreshToken);
    const employee = await this.findActiveEmployee({
      employeeNumber: rotated.employeeNumber,
    });
    if (!employee) {
      return this.closeSession(
        rotated.familyId,
        `Empleado ${rotated.employeeNumber} dado de baja: se cerró su sesión`,
      );
    }
    // RN30: a role that needs TOTP, granted after a login without it, forces a new login.
    if (requiresSecondFactor(employee.roles) && !rotated.secondFactorVerified) {
      return this.closeSession(
        rotated.familyId,
        `Empleado ${rotated.employeeNumber} tiene un rol que pide segundo factor (RN30): volvé a ingresar`,
      );
    }
    return this.buildTokenPair(
      {
        employeeNumber: employee.employeeNumber,
        roles: employee.roles,
        secondFactorVerified: rotated.secondFactorVerified,
      },
      rotated.refreshToken,
    );
  }

  /** D34: logout revokes the session family of this refresh token. */
  logout(refreshToken: string): Promise<void> {
    return this.refreshSessions.revoke(refreshToken);
  }

  private async checkPassword(
    email: string,
    password: string,
  ): Promise<ActiveEmployee> {
    const employee = await this.findActiveEmployee({ email });
    const storedHash = employee?.passwordHash ?? (await this.placeholderHash);
    const passwordMatches = await argon2.verify(storedHash, password);
    if (!employee || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return employee;
  }

  /** RN30: without a stored secret the employee sets one up now (first login, or after a reset). */
  private async challengeSecondFactor(
    employee: ActiveEmployee,
  ): Promise<LoginResult> {
    const { employeeNumber } = employee;
    if (employee.hasSecondFactor) {
      const challengeToken = await this.challenges.sign({ employeeNumber });
      return { step: 'totp_required', challengeToken };
    }
    const enrollmentSecret = this.totp.newSecret();
    const challengeToken = await this.challenges.sign({
      employeeNumber,
      enrollmentSecret,
    });
    return {
      step: 'totp_enrollment_required',
      challengeToken,
      otpauthUri: this.totp.enrollmentUri(enrollmentSecret, employee.email),
    };
  }

  private async openSession(
    employee: AuthenticatedEmployee,
  ): Promise<TokenPair> {
    const refreshToken = await this.refreshSessions.start(employee);
    return this.buildTokenPair(employee, refreshToken);
  }

  private async closeSession(familyId: string, reason: string): Promise<never> {
    await this.refreshSessions.revokeFamily(familyId);
    throw new UnauthorizedException(reason);
  }

  private async buildTokenPair(
    employee: AuthenticatedEmployee,
    refreshToken: string,
  ): Promise<TokenPair> {
    const accessToken = await this.accessTokens.sign(employee);
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
      email: employee.email,
      passwordHash: employee.passwordHash,
      roles: employee.roles.map((grant) => grant.role.name).filter(isRole),
      hasSecondFactor: employee.totpSecret !== null,
    };
  }
}
