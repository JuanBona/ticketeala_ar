// Response bodies of travel requests (UC-01), as classes so the OpenAPI contract can describe them.
import { ApiProperty } from '@nestjs/swagger';
import { DestinationSummary } from '../../administracion/dto/destination.responses.js';

/** D04: the status names of the documents and screens. */
export const TRAVEL_REQUEST_STATUS_NAMES = [
  'en_cotizacion',
  'pendiente',
  'aprobada',
  'rechazada',
  'cancelada',
] as const;

/** RN02: the policy version the request was born with, even if a newer one exists today. */
export class PolicySnapshot {
  id: number;
  version: number;
  /** ISO 4217, e.g. ARS. */
  currency: string;
  /** RN01: cap of the trip quote, as text with 2 decimals. */
  amountCap: string;
  minimumAdvanceDays: number;
  dailyAllowance: string;
}

export class TravelRequestSummary {
  id: number;
  @ApiProperty({ enum: TRAVEL_REQUEST_STATUS_NAMES })
  status: (typeof TRAVEL_REQUEST_STATUS_NAMES)[number];
  destination: DestinationSummary;
  origin: DestinationSummary | null;
  /** YYYY-MM-DD. */
  startDate: string;
  /** YYYY-MM-DD. */
  endDate: string;
  /** D11: nights between both dates. */
  nights: number;
  reason: string | null;
  /** UC-01 4a: why the minimum advance was not met. */
  advanceJustification: string | null;
  /** UC-01 9a: why the chosen quote is over the cap. */
  overCapJustification: string | null;
  /** D15, D41: assigned when the request becomes pendiente (UC-01 step 10). */
  approverEmployeeNumber: number | null;
  /** UC-01 12a. */
  rejectionReason: string | null;
  policy: PolicySnapshot;
  /** D03, D11: daily allowance × nights, as text with 2 decimals. */
  estimatedAllowance: string;
}
