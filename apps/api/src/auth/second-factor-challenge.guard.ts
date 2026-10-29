// Checks the challenge token of POST /auth/totp/verify (RN30) before the attempt limit counts it.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-employee.js';
import { SecondFactorChallengeService } from './second-factor-challenge.service.js';

@Injectable()
export class SecondFactorChallengeGuard implements CanActivate {
  constructor(private readonly challenges: SecondFactorChallengeService) {}

  /** Runs before ThrottlerGuard, so the TOTP limit counts per proven employee, not per claimed one. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Guards run before body validation, so check the type by hand here.
    const body = request.body as { challengeToken?: unknown } | undefined;
    if (typeof body?.challengeToken !== 'string') {
      throw new UnauthorizedException(
        'Falta challengeToken: primero ingresá con correo y contraseña',
      );
    }
    // Saved on the request for @CurrentChallenge and for the per-employee attempt limit.
    request.secondFactorChallenge = await this.challenges.verify(
      body.challengeToken,
    );
    return true;
  }
}
