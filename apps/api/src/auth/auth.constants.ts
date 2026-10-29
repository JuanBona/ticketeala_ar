// Session lifetimes and login attempt limits agreed in D34.
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * SECONDS_PER_MINUTE;
export const REFRESH_TOKEN_LIFETIME_MILLISECONDS = 7 * MILLISECONDS_PER_DAY;

export const LOGIN_ATTEMPTS_PER_WINDOW = 5;
export const LOGIN_ATTEMPT_WINDOW_MILLISECONDS = 60 * 1000;

/** HS256 needs a key at least as long as its 256-bit output; shorter secrets are guessable. */
export const MINIMUM_JWT_SECRET_LENGTH = 32;
export const JWT_ALGORITHM = 'HS256';
