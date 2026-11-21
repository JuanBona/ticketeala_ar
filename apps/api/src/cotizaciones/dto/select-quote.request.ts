// Body of POST /travel-requests/:id/selection (UC-01 step 9): the chosen quote and, if over the cap, why.
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const MAXIMUM_JUSTIFICATION_LENGTH = 500;

export class SelectQuoteRequest {
  @IsInt()
  quoteId: number;

  /** UC-01 9a: required only when the chosen quote is above the policy's cap. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_JUSTIFICATION_LENGTH)
  overCapJustification?: string;
}
