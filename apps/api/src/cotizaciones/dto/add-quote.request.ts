// Body of POST /travel-requests/:id/quotes (UC-03 steps 5 and 7): one agency quote or external reference.
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** D05: the two origins of a quote, with the names of the documents. */
export const QUOTE_ORIGIN_NAMES = ['agencia', 'externa'] as const;
export type QuoteOriginName = (typeof QUOTE_ORIGIN_NAMES)[number];

const MAXIMUM_DESCRIPTION_LENGTH = 255;
const MAXIMUM_SOURCE_LENGTH = 150;
/** D31: CUIT as 11 digits, without dashes. */
const CUIT_FORMAT = /^\d{11}$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class AddQuoteRequest {
  @IsIn(QUOTE_ORIGIN_NAMES)
  origin: QuoteOriginName;

  /** Flights, lodging and transfers, in the advisor's words. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_DESCRIPTION_LENGTH)
  description: string;

  // Accepts 125000.5 or "125000.50"; stored as numeric(12,2).
  @Type(() => Number)
  @IsPositive()
  amount: number;

  @IsOptional()
  @Matches(CUIT_FORMAT, {
    message: 'supplierCuit debe tener 11 dígitos, sin guiones',
  })
  supplierCuit?: string;

  /** UC-03 step 7: where an external reference comes from (site, airline…). Required for "externa". */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_SOURCE_LENGTH)
  source?: string;

  /** UC-03 step 5: until when the fare holds. Required for "agencia". */
  @IsOptional()
  @Matches(CALENDAR_DATE, {
    message: 'validUntil debe tener el formato AAAA-MM-DD',
  })
  validUntil?: string;
}
