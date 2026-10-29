// HTTP endpoints of the second factor (RN30, D35, D36): setup, code check, recovery and admin codes.
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import {
  LOGIN_PER_EMAIL_THROTTLER,
  LOGIN_PER_IP_THROTTLER,
} from './auth.constants.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import {
  CurrentChallenge,
  CurrentEmployee,
  Public,
  Roles,
} from './decorators.js';
import {
  IssueEnrollmentCodeRequest,
  RecoverRequest,
  StartEnrollmentRequest,
  VerifyTotpRequest,
} from './dto/second-factor.requests.js';
import type { IssuedEnrollmentCode } from './second-factor-codes.js';
import { SecondFactorChallengeGuard } from './second-factor-challenge.guard.js';
import type { SecondFactorChallenge } from './second-factor-challenge.service.js';
import {
  SecondFactorService,
  type EnrollmentStart,
  type SecondFactorResult,
} from './second-factor.service.js';
import type { TokenPair } from './session-issuer.service.js';

/**
 * The three step-2 endpoints share their guards: first the challenge is checked (who is it),
 * then the limit of 5 attempts per minute for that employee applies. The login limits do not.
 */
const ChallengeProtected = () =>
  UseGuards(SecondFactorChallengeGuard, ThrottlerGuard);
const WithoutLoginLimits = () =>
  SkipThrottle({
    [LOGIN_PER_EMAIL_THROTTLER]: true,
    [LOGIN_PER_IP_THROTTLER]: true,
  });

@Controller('auth/totp')
export class SecondFactorController {
  constructor(private readonly secondFactor: SecondFactorService) {}

  @Public()
  @ChallengeProtected()
  @WithoutLoginLimits()
  @Post('enroll')
  @HttpCode(HttpStatus.OK)
  enroll(
    @CurrentChallenge() challenge: SecondFactorChallenge,
    @Body() request: StartEnrollmentRequest,
  ): Promise<EnrollmentStart> {
    return this.secondFactor.startEnrollment(challenge, request.enrollmentCode);
  }

  @Public()
  @ChallengeProtected()
  @WithoutLoginLimits()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @CurrentChallenge() challenge: SecondFactorChallenge,
    @Body() request: VerifyTotpRequest,
  ): Promise<SecondFactorResult> {
    return this.secondFactor.verify(challenge, request.code);
  }

  @Public()
  @ChallengeProtected()
  @WithoutLoginLimits()
  @Post('recover')
  @HttpCode(HttpStatus.OK)
  recover(
    @CurrentChallenge() challenge: SecondFactorChallenge,
    @Body() request: RecoverRequest,
  ): Promise<TokenPair> {
    return this.secondFactor.recover(challenge, request.recoveryCode);
  }

  /** D36: only an administrator (who passed TOTP, RN30) can reset someone else's second factor. */
  @Roles('administrador')
  @Post('enrollment-codes')
  issueEnrollmentCode(
    @CurrentEmployee() administrator: AuthenticatedEmployee,
    @Body() request: IssueEnrollmentCodeRequest,
  ): Promise<IssuedEnrollmentCode> {
    return this.secondFactor.issueEnrollmentCode(
      administrator,
      request.employeeNumber,
    );
  }
}
