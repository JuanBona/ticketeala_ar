// Keys for the two independent login attempt limits of D34: one per account, one per IP.
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
