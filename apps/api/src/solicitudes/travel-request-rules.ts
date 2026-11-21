// Pure rules of UC-01 (RN01, D11, 4a): calendar days, nights, minimum advance and estimated allowance.
import { Prisma } from '../generated/prisma/client.js';

/** Dates are counted in Argentina: a request sent at 23:30 in Rosario belongs to that day, not to UTC's. */
const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Today's date in Argentina as YYYY-MM-DD (the en-CA locale happens to format dates that way). */
export function todayInArgentina(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
  }).format(now);
}

/** Whole days from one YYYY-MM-DD date to another (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  // Both dates are read at UTC midnight, so daylight saving can never add or remove an hour.
  const difference =
    Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(difference / MILLISECONDS_PER_DAY);
}

/** UC-01 4a: true when the trip starts sooner than the policy's minimum advance allows. */
export function missesMinimumAdvance(
  today: string,
  startDate: string,
  minimumAdvanceDays: number,
): boolean {
  return daysBetween(today, startDate) < minimumAdvanceDays;
}

/** D02, D03, D11: daily allowance × nights (from 24 to 27 there are 3 nights). Same-day trips get 0. */
export function estimateAllowance(
  dailyAllowance: Prisma.Decimal,
  nights: number,
): Prisma.Decimal {
  // Decimal, not number: money must not pick up floating point errors (numeric(12,2)).
  return new Prisma.Decimal(dailyAllowance).mul(nights);
}
