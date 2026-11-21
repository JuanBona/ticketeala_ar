// Response bodies of quotes (UC-01 steps 7 to 9, UC-03).
import { ApiProperty } from '@nestjs/swagger';
import {
  QUOTE_ORIGIN_NAMES,
  type QuoteOriginName,
} from './add-quote.request.js';

export class QuoteView {
  id: number;
  @ApiProperty({ enum: QUOTE_ORIGIN_NAMES })
  origin: QuoteOriginName;
  description: string;
  supplierCuit: string | null;
  /** External references only: where the price comes from. */
  source: string | null;
  /** Text with 2 decimals, in the currency of the request's policy. */
  amount: string;
  /** YYYY-MM-DD; null when the fare has no expiry. */
  validUntil: string | null;
  /** RN11: an expired quote cannot be selected. */
  expired: boolean;
  /** UC-01 9a, UC-03 5a: choosing it needs a justification and a higher approver. */
  exceedsCap: boolean;
  /** Agency quotes only: cheapest external minus this amount; null without an external reference. */
  savingsAgainstExternal: string | null;
  selected: boolean;
}

/** UC-01 step 8: the comparison the employee sees before choosing. */
export class QuoteComparison {
  travelRequestId: number;
  currency: string;
  amountCap: string;
  lowestExternalAmount: string | null;
  quotes: QuoteView[];
}
