// Authentication module (D12, D34): tokens, sessions and the global guards that protect every endpoint.
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  JWT_ALGORITHM,
  LOGIN_ATTEMPT_WINDOW_MILLISECONDS,
  LOGIN_ATTEMPTS_PER_WINDOW,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { readJwtSecret } from './jwt-secret.js';
import { trackLoginAttempt } from './login-attempt-tracker.js';
import { RefreshSessionService } from './refresh-session.service.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: readJwtSecret(),
        // Pinning the algorithm stops forged tokens that declare "none" or another algorithm.
        signOptions: {
          algorithm: JWT_ALGORITHM,
          expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
        },
        verifyOptions: { algorithms: [JWT_ALGORITHM] },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: LOGIN_ATTEMPT_WINDOW_MILLISECONDS,
          limit: LOGIN_ATTEMPTS_PER_WINDOW,
        },
      ],
      getTracker: trackLoginAttempt,
      errorMessage: `Demasiados intentos de ingreso: máximo ${LOGIN_ATTEMPTS_PER_WINDOW} por minuto`,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AccessTokenService,
    RefreshSessionService,
    AuthService,
    // Order matters: first prove who is calling, then check what they may do.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
