// Keys for the login attempt limits: per account and per IP (D34), and per employee for TOTP codes (RN30).
/**
 * Per account: stops guessing one password from many IPs. Per IP, with a higher cap: stops one
 * address from trying a few common passwords on every account (password spraying).
 */
export function trackLoginByEmail(request: Record<string, unknown>): string {
  const body = request.body as { email?: unknown } | undefined;
  return typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
}

export function trackLoginByIp(request: Record<string, unknown>): string {
  return String(request.ip);
}

/** RN30: 5 codes per minute per employee make guessing 6 digits take weeks, not minutes. */
export function trackTotpByEmployee(request: Record<string, unknown>): string {
  const challenge = request.secondFactorChallenge as
    { employeeNumber?: number } | undefined;
  return String(challenge?.employeeNumber ?? '');
}
