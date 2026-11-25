// Holds the session tokens: the JWT only in memory, the refresh token in sessionStorage (D34).
import { ApiError } from '../api/api-error.js';
import { requestJson, type JsonRequest } from '../api/http-client.js';
import { refreshTokens, type TokenPair } from './auth-api.js';

const REFRESH_TOKEN_STORAGE_KEY = 'amr-viajes.refresh-token';
const UNAUTHORIZED = 401;

export class SessionExpiredError extends Error {
  constructor() {
    super('La sesión venció o se cerró: hay que ingresar de nuevo');
    this.name = 'SessionExpiredError';
  }
}

/**
 * The access token never touches storage, so a script injected into the page cannot read it later.
 * The refresh token survives a page reload but not closing the tab (sessionStorage).
 */
export class Session {
  private accessToken: string | null = null;
  /** One refresh at a time: D34 revokes the whole session if a rotated refresh token is reused. */
  private refreshInFlight: Promise<string> | null = null;

  constructor(private readonly storage: Storage) {}

  hasStoredSession(): boolean {
    return this.storage.getItem(REFRESH_TOKEN_STORAGE_KEY) !== null;
  }

  start(tokens: TokenPair): void {
    this.accessToken = tokens.accessToken;
    this.storage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
  }

  /** Forgets the tokens and returns the refresh token, so the caller can close it in the API. */
  clear(): string | null {
    const refreshToken = this.storage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    this.accessToken = null;
    this.storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    return refreshToken;
  }

  /** The current JWT, renewing it first when there is none in memory (after a page reload). */
  async currentAccessToken(): Promise<string> {
    return this.accessToken ?? this.refresh();
  }

  /** Calls the API with the JWT; if it expired (15 min, D34) renews it once and repeats the call. */
  async request<ResponseBody>(path: string, request: Omit<JsonRequest, 'accessToken'>): Promise<ResponseBody> {
    const accessToken = await this.currentAccessToken();
    try {
      return await requestJson<ResponseBody>(path, { ...request, accessToken });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== UNAUTHORIZED) {
        throw error;
      }
      const renewedToken = await this.refresh();
      return requestJson<ResponseBody>(path, { ...request, accessToken: renewedToken });
    }
  }

  /** Renews the pair; concurrent callers share the same request instead of each sending the token. */
  refresh(): Promise<string> {
    this.refreshInFlight ??= this.rotateTokens().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async rotateTokens(): Promise<string> {
    const refreshToken = this.storage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (refreshToken === null) {
      throw new SessionExpiredError();
    }
    try {
      const tokens = await refreshTokens(refreshToken);
      this.start(tokens);
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === UNAUTHORIZED) {
        this.clear();
        throw new SessionExpiredError();
      }
      throw error;
    }
  }
}
