// How quotes are shown (UC-01 step 8): each one against the policy cap and the cheapest external reference.
import type { Prisma, Quote, QuoteOrigin } from '../generated/prisma/client.js';
import type { QuotingContext } from '../solicitudes/travel-requests.service.js';
import type { QuoteOriginName } from './dto/add-quote.request.js';
import { exceedsCap, isExpired, savingsAgainst } from './quote-rules.js';

export const ORIGIN_NAMES: Record<QuoteOrigin, QuoteOriginName> = {
  AGENCY: 'agencia',
  EXTERNAL: 'externa',
};

export interface QuoteView {
  id: number;
  origin: QuoteOriginName;
  description: string;
  supplierCuit: string | null;
  source: string | null;
  amount: string;
  validUntil: string | null;
  /** RN11: an expired quote cannot be selected. */
  expired: boolean;
  /** UC-01 9a, UC-03 5a: choosing it needs a justification and a higher approver. */
  exceedsCap: boolean;
  /** Agency quotes only: cheapest external minus this amount; null without an external reference. */
  savingsAgainstExternal: string | null;
  selected: boolean;
}

export interface QuoteComparison {
  travelRequestId: number;
  currency: string;
  amountCap: string;
  lowestExternalAmount: string | null;
  quotes: QuoteView[];
}

/** UC-01 step 8: the comparison the employee sees before choosing. */
export function toQuoteComparison(
  context: QuotingContext,
  quotes: Quote[],
  today: string,
): QuoteComparison {
  const lowestExternal = lowestExternalAmount(quotes);
  return {
    travelRequestId: context.id,
    currency: context.currency,
    amountCap: context.amountCap.toFixed(2),
    lowestExternalAmount: lowestExternal?.toFixed(2) ?? null,
    quotes: quotes.map((quote) =>
      toQuoteView(quote, { context, lowestExternal, today }),
    ),
  };
}

interface QuoteViewContext {
  context: QuotingContext;
  lowestExternal: Prisma.Decimal | null;
  today: string;
}

export function toQuoteView(quote: Quote, view: QuoteViewContext): QuoteView {
  // `date` columns come back as Date at UTC midnight; keep only YYYY-MM-DD.
  const validUntil = quote.validUntil?.toISOString().slice(0, 10) ?? null;
  // Savings only make sense for what can be bought: agency quotes (RN10).
  const savings =
    quote.origin === 'AGENCY'
      ? savingsAgainst(quote.amount, view.lowestExternal)
      : null;
  return {
    id: quote.id,
    origin: ORIGIN_NAMES[quote.origin],
    description: quote.description,
    supplierCuit: quote.supplierCuit,
    source: quote.source,
    amount: quote.amount.toFixed(2),
    validUntil,
    expired: isExpired(validUntil, view.today),
    exceedsCap: exceedsCap(quote.amount, view.context.amountCap),
    savingsAgainstExternal: savings?.toFixed(2) ?? null,
    selected: quote.selected,
  };
}

function lowestExternalAmount(quotes: Quote[]): Prisma.Decimal | null {
  const externals = quotes.filter((quote) => quote.origin === 'EXTERNAL');
  if (externals.length === 0) {
    return null;
  }
  return externals.reduce((lowest, quote) =>
    quote.amount.lessThan(lowest.amount) ? quote : lowest,
  ).amount;
}
