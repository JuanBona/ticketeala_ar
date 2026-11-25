// How the tray writes amounts, dates, initials and the policy chip (RN01, UC-01 9a).
import type { ApprovalView } from './approvals-api.js';

const LOCALE = 'es-AR';
const PERCENT = 100;
/** The seed marks invented people with this suffix; initials are taken from the name only. */
const SYNTHETIC_SUFFIX = /\s*\(sintético\)\s*$/;

/** Amounts arrive as text with 2 decimals ("354000.00"); the screen shows "$ 354.000". */
export function formatAmount(amountText: string, currency: string): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amountText));
}

/** YYYY-MM-DD read as a calendar day, so the time zone never moves it to the day before. */
function calendarDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

const dayFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: 'UTC' });
const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "9–11 dic" inside one month, "28 nov – 2 dic" across two. */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = calendarDay(startDate);
  const end = calendarDay(endDate);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const clean = (text: string) => text.replace('.', '');
  if (sameMonth) {
    return `${dayFormat.format(start)}–${clean(dayMonthFormat.format(end))}`;
  }
  return `${clean(dayMonthFormat.format(start))} – ${clean(dayMonthFormat.format(end))}`;
}

export function initialsOf(fullName: string): string {
  const words = fullName.replace(SYNTHETIC_SUFFIX, '').split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export type PolicyStatus = { withinPolicy: true } | { withinPolicy: false; excessPercent: number };

/**
 * RN01, UC-01 9a: compares the chosen quote with the cap of the policy the request was born with.
 * The percentage rounds up, so an excess of a few pesos never reads as "+0 %".
 */
export function policyStatus(request: Pick<ApprovalView, 'selectedQuote' | 'policy'>): PolicyStatus {
  if (request.selectedQuote === null || !request.selectedQuote.exceedsCap) {
    return { withinPolicy: true };
  }
  const amount = Number(request.selectedQuote.amount);
  const cap = Number(request.policy.amountCap);
  return { withinPolicy: false, excessPercent: Math.ceil(((amount - cap) / cap) * PERCENT) };
}

/** "1 noche", "3 noches". */
export function nightsLabel(nights: number): string {
  return nights === 1 ? '1 noche' : `${nights} noches`;
}
