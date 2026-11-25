// Calls to the /auth endpoints of docs/contratos/api.openapi.yaml (D12, D34, D35, D36).
import { requestJson } from '../api/http-client.js';
import type { components } from '../api/schema.js';

type Schemas = components['schemas'];
export type LoginRequest = Schemas['LoginRequest'];
export type LoginResponse = Schemas['LoginResponse'];
export type TokenPair = Schemas['TokenPair'];
export type EnrollmentStart = Schemas['EnrollmentStart'];
export type SecondFactorResult = Schemas['SecondFactorResult'];
export type EmployeeIdentity = Schemas['EmployeeIdentity'];
export type Role = EmployeeIdentity['roles'][number];

/** Step 1 of the Login screen: the answer says whether a TOTP step follows (RN30). */
export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return requestJson('/auth/login', { method: 'POST', body: credentials });
}

/** D36: trades the enrollment code an administrator handed out for the QR of the new secret. */
export function startEnrollment(request: Schemas['StartEnrollmentRequest']): Promise<EnrollmentStart> {
  return requestJson('/auth/totp/enroll', { method: 'POST', body: request });
}

/** D35: the 6-digit code of the authenticator app; after a setup it also returns the recovery codes. */
export function verifyTotp(request: Schemas['VerifyTotpRequest']): Promise<SecondFactorResult> {
  return requestJson('/auth/totp/verify', { method: 'POST', body: request });
}

/** D36: a one-time recovery code instead of the app code, for a lost phone. */
export function recoverWithCode(request: Schemas['RecoverRequest']): Promise<TokenPair> {
  return requestJson('/auth/totp/recover', { method: 'POST', body: request });
}

/** D34: rotates the refresh token; the old one stops working. */
export function refreshTokens(refreshToken: string): Promise<TokenPair> {
  return requestJson('/auth/refresh', { method: 'POST', body: { refreshToken } });
}

export function logout(refreshToken: string): Promise<void> {
  return requestJson('/auth/logout', { method: 'POST', body: { refreshToken } });
}

export function fetchCurrentEmployee(accessToken: string): Promise<EmployeeIdentity> {
  return requestJson('/auth/me', { method: 'GET', accessToken });
}
