// Authentication module (D12, D34, RN30): tokens, sessions, TOTP and the global guards that protect every endpoint.
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from '../auditoria/audit.module.js';
import { AccessTokenService } from './access-token.service.js';
import { ActiveEmployeeReader } from './active-employee.reader.js';
import { AuthController } from './auth.controller.js';
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  JWT_ALGORITHM,
  LOGIN_ATTEMPT_WINDOW_MILLISECONDS,
  LOGIN_ATTEMPTS_PER_EMAIL_PER_WINDOW,
  LOGIN_ATTEMPTS_PER_IP_PER_WINDOW,
  LOGIN_PER_EMAIL_THROTTLER,
  LOGIN_PER_IP_THROTTLER,
  TOTP_ATTEMPTS_PER_EMPLOYEE_PER_WINDOW,
  TOTP_PER_EMPLOYEE_THROTTLER,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { readJwtSecret } from './jwt-secret.js';
import {
  trackLoginByEmail,
  trackLoginByIp,
  trackTotpByEmployee,
} from './login-attempt-tracker.js';
import { RefreshSessionService } from './refresh-session.service.js';
import { RolesGuard } from './roles.guard.js';
import { SecondFactorChallengeGuard } from './second-factor-challenge.guard.js';
import { SecondFactorChallengeService } from './second-factor-challenge.service.js';
import { SecondFactorController } from './second-factor.controller.js';
import { SecondFactorService } from './second-factor.service.js';
import { SessionIssuer } from './session-issuer.service.js';
import { TotpSecretCipher } from './totp-secret-cipher.js';
import { TotpService } from './totp.service.js';

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: readJwtSecret(),
        // Pinning the algorithm stops forged tokens that declare "none" or another algorithm.
        // Access tokens use these defaults; challenge tokens override audience and expiry.
        signOptions: {
          algorithm: JWT_ALGORITHM,
          expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
        },
        verifyOptions: { algorithms: [JWT_ALGORITHM] },
      }),
    }),
    // Three independent limits; each endpoint skips the ones that are not about it.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: LOGIN_PER_EMAIL_THROTTLER,
          ttl: LOGIN_ATTEMPT_WINDOW_MILLISECONDS,
          limit: LOGIN_ATTEMPTS_PER_EMAIL_PER_WINDOW,
          getTracker: trackLoginByEmail,
        },
        {
          name: LOGIN_PER_IP_THROTTLER,
          ttl: LOGIN_ATTEMPT_WINDOW_MILLISECONDS,
          limit: LOGIN_ATTEMPTS_PER_IP_PER_WINDOW,
          getTracker: trackLoginByIp,
        },
        {
          name: TOTP_PER_EMPLOYEE_THROTTLER,
          ttl: LOGIN_ATTEMPT_WINDOW_MILLISECONDS,
          limit: TOTP_ATTEMPTS_PER_EMPLOYEE_PER_WINDOW,
          getTracker: trackTotpByEmployee,
        },
      ],
      errorMessage:
        'Demasiados intentos de ingreso: esperá un minuto y probá de nuevo',
    }),
  ],
  controllers: [AuthController, SecondFactorController],
  providers: [
    AccessTokenService,
    ActiveEmployeeReader,
    RefreshSessionService,
    SessionIssuer,
    AuthService,
    SecondFactorService,
    SecondFactorChallengeService,
    SecondFactorChallengeGuard,
    TotpSecretCipher,
    TotpService,
    // Order matters: first prove who is calling, then check what they may do.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
