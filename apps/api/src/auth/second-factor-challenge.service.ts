// Challenge token between password and TOTP (RN30): proves step 1 passed, opens nothing but step 2.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  SECOND_FACTOR_CHALLENGE_AUDIENCE,
  SECOND_FACTOR_CHALLENGE_LIFETIME_SECONDS,
} from './auth.constants.js';

export interface SecondFactorChallenge {
  employeeNumber: number;
  /** Present only at first enrollment: the new secret, already shown to the employee in the QR. */
  enrollmentSecret?: string;
}

interface ChallengeClaims {
  sub: string;
  enrollmentSecret?: string;
}

@Injectable()
export class SecondFactorChallengeService {
  constructor(private readonly jwtService: JwtService) {}

  /** RN30: issued after the right password to an employee whose roles need TOTP. */
  sign(challenge: SecondFactorChallenge): Promise<string> {
    const claims: ChallengeClaims = {
      sub: String(challenge.employeeNumber),
      enrollmentSecret: challenge.enrollmentSecret,
    };
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
    return { employeeNumber, enrollmentSecret: claims.enrollmentSecret };
  }

  private async readClaims(token: string): Promise<ChallengeClaims> {
    try {
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
