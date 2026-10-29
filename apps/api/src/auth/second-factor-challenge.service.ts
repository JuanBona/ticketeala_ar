// Challenge token between password and TOTP (RN30): proves step 1 passed, opens nothing but the TOTP endpoints.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  SECOND_FACTOR_CHALLENGE_AUDIENCE,
  SECOND_FACTOR_CHALLENGE_LIFETIME_SECONDS,
} from './auth.constants.js';

/** Data of a TOTP setup in progress (D36): the new secret and the enrollment code that allowed it. */
export interface PendingEnrollment {
  /** The new TOTP secret, already shown to the employee in the QR. */
  secret: string;
  /** Id of the enrollment code; it is spent when the first TOTP code confirms the setup. */
  enrollmentCodeId: string;
}

export interface SecondFactorChallenge {
  employeeNumber: number;
  /** Present only after POST /auth/totp/enroll accepted an enrollment code. */
  enrollment?: PendingEnrollment;
}

interface ChallengeClaims {
  sub: string;
  enrollment?: PendingEnrollment;
}

@Injectable()
export class SecondFactorChallengeService {
  constructor(private readonly jwtService: JwtService) {}

  /** RN30: issued after the right password, or after a valid enrollment code (D36). */
  sign(challenge: SecondFactorChallenge): Promise<string> {
    const claims: ChallengeClaims = {
      sub: String(challenge.employeeNumber),
      enrollment: challenge.enrollment,
    };
    // Its own audience keeps it apart from access tokens: neither works where the other goes.
    return this.jwtService.signAsync(claims, {
      audience: SECOND_FACTOR_CHALLENGE_AUDIENCE,
      expiresIn: SECOND_FACTOR_CHALLENGE_LIFETIME_SECONDS,
    });
  }

  /** Rejects access tokens and expired challenges: only a live challenge reaches the TOTP check. */
  async verify(token: string): Promise<SecondFactorChallenge> {
    const claims = await this.readClaims(token);
    const employeeNumber = Number(claims.sub);
    if (!Number.isInteger(employeeNumber)) {
      throw new UnauthorizedException(
        `Desafío de segundo factor con datos inválidos: sub=${claims.sub}`,
      );
    }
    return { employeeNumber, enrollment: claims.enrollment };
  }

  private async readClaims(token: string): Promise<ChallengeClaims> {
    try {
      // Checks signature, algorithm, expiry and that the audience is the challenge one.
      return await this.jwtService.verifyAsync<ChallengeClaims>(token, {
        audience: SECOND_FACTOR_CHALLENGE_AUDIENCE,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UnauthorizedException(
        `Desafío de segundo factor rechazado: ${reason}`,
      );
    }
  }
}
