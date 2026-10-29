// Opens sessions and builds the token pair answered by login, TOTP and refresh (D12, D34).
import { Injectable } from '@nestjs/common';
import { AccessTokenService } from './access-token.service.js';
import { ACCESS_TOKEN_LIFETIME_SECONDS } from './auth.constants.js';
import type { AuthenticatedEmployee } from './authenticated-employee.js';
import { RefreshSessionService } from './refresh-session.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

@Injectable()
export class SessionIssuer {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly refreshSessions: RefreshSessionService,
  ) {}

  /** D34: a new session family (first refresh token) plus a fresh access token. */
  async open(employee: AuthenticatedEmployee): Promise<TokenPair> {
    const refreshToken = await this.refreshSessions.start(employee);
    return this.tokenPair(employee, refreshToken);
  }

  /** Signs an access token and pairs it with a refresh token that already exists. */
  async tokenPair(
    employee: AuthenticatedEmployee,
    refreshToken: string,
  ): Promise<TokenPair> {
    const accessToken = await this.accessTokens.sign(employee);
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: ACCESS_TOKEN_LIFETIME_SECONDS,
    };
  }
}
