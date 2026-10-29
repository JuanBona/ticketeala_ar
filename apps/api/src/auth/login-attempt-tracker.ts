// Groups login attempts by IP and email for the D34 limit (5 per minute).
/**
 * Counting by IP alone would lock out a whole office behind one public IP; counting by email
 * alone would let anyone lock out a colleague. Together they slow down guessing one account.
 */
export function trackLoginAttempt(request: Record<string, unknown>): string {
  const body = request.body as { email?: unknown } | undefined;
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return `${String(request.ip)}:${email}`;
}
