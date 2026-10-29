// Step 1 of the login (D12, RN30), refresh and logout (D34). The TOTP step lives in SecondFactorService.
import { randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import {
  ActiveEmployeeReader,
  type ActiveEmployee,
} from './active-employee.reader.js';
import { RefreshSessionService } from './refresh-session.service.js';
import { requiresSecondFactor } from './role.js';
import { SecondFactorChallengeService } from './second-factor-challenge.service.js';
import { SessionIssuer, type TokenPair } from './session-issuer.service.js';

/** Same message for unknown email and wrong password, so nobody can probe which emails exist. */
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const PLACEHOLDER_PASSWORD_BYTES = 32;

/** What step 1 of the Login screen leads to: in, TOTP code, or TOTP setup with an enrollment code. */
export type LoginResult =
  | ({ step: 'authenticated' } & TokenPair)
  | { step: 'totp_required'; challengeToken: string }
  | { step: 'totp_enrollment_required'; challengeToken: string };

@Injectable()
export class AuthService {
  /** Checked when the email does not exist, so both failures take the same argon2 time. */
  private readonly placeholderHash = argon2.hash(
    randomBytes(PLACEHOLDER_PASSWORD_BYTES),
  );

  constructor(
    private readonly employees: ActiveEmployeeReader,
    private readonly refreshSessions: RefreshSessionService,
    private readonly challenges: SecondFactorChallengeService,
    private readonly sessions: SessionIssuer,
  ) {}

  /** D12, RN28, RN30: right password and active employee; RN30 roles still owe a TOTP code. */
  async login(email: string, password: string): Promise<LoginResult> {
    const employee = await this.checkPassword(email, password);
    // RN30 roles do not get tokens yet: they get a challenge for step 2.
    if (requiresSecondFactor(employee.roles)) {
      const challengeToken = await this.challenges.sign({
        employeeNumber: employee.employeeNumber,
      });
      // Without a stored secret the next step is setting up TOTP (POST /auth/totp/enroll).
      const step = employee.hasSecondFactor
        ? 'totp_required'
        : 'totp_enrollment_required';
      return { step, challengeToken };
    }
    const tokens = await this.sessions.open({
      employeeNumber: employee.employeeNumber,
      roles: employee.roles,
      secondFactorVerified: false,
    });
    return { step: 'authenticated', ...tokens };
  }

  /** D34: rotates the refresh token and reloads roles, so role changes apply at the next refresh. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    // Throws if the token is unknown, expired or reused (and then closes the whole session).
    const rotated = await this.refreshSessions.rotate(refreshToken);
    const employee = await this.employees.find({
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
    return this.sessions.tokenPair(
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
    const employee = await this.employees.find({ email });
    // Always run argon2, even for an unknown email, so the response time reveals nothing.
    const storedHash = employee?.passwordHash ?? (await this.placeholderHash);
    const passwordMatches = await argon2.verify(storedHash, password);
    if (!employee || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return employee;
  }

  private async closeSession(familyId: string, reason: string): Promise<never> {
    await this.refreshSessions.revokeFamily(familyId);
    throw new UnauthorizedException(reason);
  }
}
