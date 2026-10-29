// Session lifetimes and attempt limits (D34) and the TOTP second factor settings (RN30, D35).
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * SECONDS_PER_MINUTE;
export const REFRESH_TOKEN_LIFETIME_MILLISECONDS = 7 * MILLISECONDS_PER_DAY;

export const LOGIN_ATTEMPTS_PER_EMAIL_PER_WINDOW = 10;
export const LOGIN_ATTEMPTS_PER_IP_PER_WINDOW = 30;
export const LOGIN_ATTEMPT_WINDOW_MILLISECONDS = 60 * 1000;

/** Throttler names, so each endpoint can opt out of the limits that are not about it. */
export const LOGIN_PER_EMAIL_THROTTLER = 'login-per-email';
export const LOGIN_PER_IP_THROTTLER = 'login-per-ip';
export const TOTP_PER_EMPLOYEE_THROTTLER = 'totp-per-employee';

/** HS256 needs a key at least as long as its 256-bit output; shorter secrets are guessable. */
export const MINIMUM_JWT_SECRET_LENGTH = 32;
export const JWT_ALGORITHM = 'HS256';

/** The `aud` claim keeps the two kinds of JWT apart: neither is accepted where the other goes. */
export const ACCESS_TOKEN_AUDIENCE = 'amr-viajes-api';
export const SECOND_FACTOR_CHALLENGE_AUDIENCE = 'amr-viajes-segundo-factor';
export const SECOND_FACTOR_CHALLENGE_LIFETIME_SECONDS = 5 * SECONDS_PER_MINUTE;

/** RN30 second factor (D35): RFC 6238 defaults that every authenticator app supports. */
export const TOTP_SECRET_BYTES = 20;
export const TOTP_ISSUER = 'AMR Viajes';
/** One 30-second step on each side, for phones whose clock drifts a little. */
export const TOTP_CLOCK_TOLERANCE_SECONDS = 30;
export const TOTP_ATTEMPTS_PER_EMPLOYEE_PER_WINDOW = 5;
export const TOTP_ENCRYPTION_KEY_BYTES = 32;

/** D36: one-time codes of the second factor. */
export const SECOND_FACTOR_CODE_BYTES = 10;
export const SECOND_FACTOR_CODE_GROUP_LENGTH = 4;
export const ENROLLMENT_CODE_LIFETIME_MILLISECONDS = MILLISECONDS_PER_DAY;
export const RECOVERY_CODE_COUNT = 8;
