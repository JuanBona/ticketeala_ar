// The steps of the Login screen and which one follows each answer of the API.
import type { LoginResponse, SecondFactorResult, TokenPair } from '../../auth/auth-api.js';

export type LoginStep =
  | { name: 'credentials' }
  | { name: 'totp'; challengeToken: string }
  | { name: 'recovery'; challengeToken: string }
  | { name: 'enrollmentCode'; challengeToken: string }
  | { name: 'enrollmentQr'; challengeToken: string; otpauthUri: string }
  | { name: 'recoveryCodes'; recoveryCodes: string[]; tokens: TokenPair };

export type LoginOutcome = { kind: 'signedIn'; tokens: TokenPair } | { kind: 'nextStep'; step: LoginStep };

/** RN30: roles aprobador, contaduria and administrador do not get tokens until they pass TOTP. */
export function outcomeOfLogin(response: LoginResponse): LoginOutcome {
  const { step, challengeToken, accessToken, refreshToken, expiresInSeconds } = response;
  if (step === 'authenticated') {
    if (accessToken === undefined || refreshToken === undefined || expiresInSeconds === undefined) {
      throw new Error('La API respondió "authenticated" sin tokens');
    }
    return { kind: 'signedIn', tokens: { accessToken, refreshToken, expiresInSeconds } };
  }
  if (challengeToken === undefined) {
    throw new Error(`La API respondió "${step}" sin challengeToken`);
  }
  const name = step === 'totp_required' ? 'totp' : 'enrollmentCode';
  return { kind: 'nextStep', step: { name, challengeToken } };
}

/** D36: the first code after a setup also brings the recovery codes, which must be shown once. */
export function outcomeOfVerification(result: SecondFactorResult): LoginOutcome {
  const { recoveryCodes, ...tokens } = result;
  if (recoveryCodes === undefined || recoveryCodes.length === 0) {
    return { kind: 'signedIn', tokens };
  }
  return { kind: 'nextStep', step: { name: 'recoveryCodes', recoveryCodes, tokens } };
}

/** The secret inside the otpauth:// link, in groups of 4, for typing it when the QR cannot be scanned. */
export function manualEntryKey(otpauthUri: string): string {
  const secret = new URL(otpauthUri).searchParams.get('secret');
  if (secret === null) {
    throw new Error(`El link de alta no trae la clave: ${otpauthUri}`);
  }
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}
