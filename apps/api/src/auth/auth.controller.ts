// HTTP endpoints of authentication (D12, D34): login, refresh, logout and who am I.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, type TokenPair } from './auth.service.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { CurrentEmployee, Public } from './decorators.js';
import { LoginRequest } from './dto/login.request.js';
import { RefreshRequest } from './dto/refresh.request.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() request: LoginRequest): Promise<TokenPair> {
    return this.authService.login(request.email, request.password);
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
