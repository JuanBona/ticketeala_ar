// HTTP endpoints of authentication (D12, D34, RN30): login, TOTP step, refresh, logout and who am I.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AuthService,
  type LoginResult,
  type TokenPair,
} from './auth.service.js';
import {
  LOGIN_PER_EMAIL_THROTTLER,
  LOGIN_PER_IP_THROTTLER,
  TOTP_PER_EMPLOYEE_THROTTLER,
} from './auth.constants.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { CurrentChallenge, CurrentEmployee, Public } from './decorators.js';
import { LoginRequest } from './dto/login.request.js';
import { RefreshRequest } from './dto/refresh.request.js';
import { VerifyTotpRequest } from './dto/verify-totp.request.js';
import { SecondFactorChallengeGuard } from './second-factor-challenge.guard.js';
import type { SecondFactorChallenge } from './second-factor-challenge.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ [TOTP_PER_EMPLOYEE_THROTTLER]: true })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() request: LoginRequest): Promise<LoginResult> {
    return this.authService.login(request.email, request.password);
  }

  @Public()
  @UseGuards(SecondFactorChallengeGuard, ThrottlerGuard)
  @SkipThrottle({
    [LOGIN_PER_EMAIL_THROTTLER]: true,
    [LOGIN_PER_IP_THROTTLER]: true,
  })
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  verifyTotp(
    @CurrentChallenge() challenge: SecondFactorChallenge,
    @Body() request: VerifyTotpRequest,
  ): Promise<TokenPair> {
    return this.authService.completeSecondFactor(challenge, request.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() request: RefreshRequest): Promise<TokenPair> {
    return this.authService.refresh(request.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() request: RefreshRequest): Promise<void> {
    return this.authService.logout(request.refreshToken);
  }

  @Get('me')
  me(
    @CurrentEmployee() employee: AuthenticatedEmployee,
  ): AuthenticatedEmployee {
    return employee;
  }
}
