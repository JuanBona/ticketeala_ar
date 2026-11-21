// How a travel request is shown to the apps: domain names in Spanish, money as text with 2 decimals.
import type { DestinationSummary } from '../administracion/destination-catalog.service.js';
import type {
  ExpensePolicy,
  Prisma,
  TravelRequest,
  TravelRequestStatus,
} from '../generated/prisma/client.js';
import { daysBetween } from './travel-request-rules.js';

/** The status names of the documents and screens (D04), instead of the code's English ones. */
export const STATUS_NAMES: Record<TravelRequestStatus, string> = {
  QUOTING: 'en_cotizacion',
  PENDING: 'pendiente',
  APPROVED: 'aprobada',
  REJECTED: 'rechazada',
  CANCELLED: 'cancelada',
};

export interface TravelRequestSummary {
  id: number;
  status: string;
  destination: DestinationSummary;
  origin: DestinationSummary | null;
  startDate: string;
  endDate: string;
  nights: number;
  reason: string | null;
  advanceJustification: string | null;
  overCapJustification: string | null;
  /** RN02: the policy version the request was born with, even if a newer one exists today. */
  policy: {
    id: number;
    version: number;
    currency: string;
    amountCap: string;
    minimumAdvanceDays: number;
    dailyAllowance: string;
  };
  estimatedAllowance: string;
}

export interface TravelRequestParts {
  travelRequest: TravelRequest;
  destination: DestinationSummary;
  origin: DestinationSummary | null;
  policy: ExpensePolicy;
  estimatedAllowance: Prisma.Decimal;
}

export function toTravelRequestSummary(
  parts: TravelRequestParts,
): TravelRequestSummary {
  const { travelRequest, policy } = parts;
  // `date` columns come back as Date at UTC midnight; keep only the YYYY-MM-DD part.
  const startDate = travelRequest.startDate.toISOString().slice(0, 10);
  const endDate = travelRequest.endDate.toISOString().slice(0, 10);
  return {
    id: travelRequest.id,
    status: STATUS_NAMES[travelRequest.status],
    destination: parts.destination,
    origin: parts.origin,
    startDate,
    endDate,
    nights: daysBetween(startDate, endDate),
    reason: travelRequest.reason,
    advanceJustification: travelRequest.advanceJustification,
    overCapJustification: travelRequest.overCapJustification,
    policy: {
      id: policy.id,
      version: policy.version,
      currency: policy.currency,
      amountCap: policy.amountCap.toFixed(2),
      minimumAdvanceDays: policy.minimumAdvanceDays,
      dailyAllowance: policy.dailyAllowance.toFixed(2),
    },
    estimatedAllowance: parts.estimatedAllowance.toFixed(2),
  };
}
