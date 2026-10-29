// HTTP endpoints of authentication (D12, D34): login, refresh, logout and who am I. TOTP: SecondFactorController.
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
import { TOTP_PER_EMPLOYEE_THROTTLER } from './auth.constants.js';
import { AuthService, type LoginResult } from './auth.service.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { CurrentEmployee, Public } from './decorators.js';
import { LoginRequest } from './dto/login.request.js';
import { RefreshRequest } from './dto/refresh.request.js';
import type { TokenPair } from './session-issuer.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Public: there is no token yet. ThrottlerGuard: 10 attempts per email and 30 per IP each minute.
  @Public()
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ [TOTP_PER_EMPLOYEE_THROTTLER]: true })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() request: LoginRequest): Promise<LoginResult> {
    return this.authService.login(request.email, request.password);
  }

  // @Public: the access token may have expired already; the refresh token is the proof.
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

  // Not @Public: the global guard already checked the token and put the employee on the request.
  @Get('me')
  me(
    @CurrentEmployee() employee: AuthenticatedEmployee,
  ): AuthenticatedEmployee {
    return employee;
  }
}
