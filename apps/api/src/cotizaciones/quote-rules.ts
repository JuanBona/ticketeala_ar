// Pure rules of quotes (UC-01 8–9, UC-03): expiry (RN11), cap (RN01, 9a) and savings against the external reference.
import type { Prisma } from '../generated/prisma/client.js';
import { daysBetween } from '../solicitudes/travel-request-rules.js';

/** RN11: a quote whose fare validity ended before today cannot be selected. No date means no expiry. */
export function isExpired(validUntil: string | null, today: string): boolean {
  return validUntil !== null && daysBetween(today, validUntil) < 0;
}

/** UC-01 9a, UC-03 5a: true when the amount is above the cap of the request's policy. */
export function exceedsCap(
  amount: Prisma.Decimal,
  amountCap: Prisma.Decimal,
): boolean {
  return amount.greaterThan(amountCap);
}

/** UC-03 step 10: how much an agency quote saves against the cheapest external reference (negative if it costs more). */
export function savingsAgainst(
  amount: Prisma.Decimal,
  lowestExternalAmount: Prisma.Decimal | null,
): Prisma.Decimal | null {
  return lowestExternalAmount === null
    ? null
    : lowestExternalAmount.minus(amount);
}
