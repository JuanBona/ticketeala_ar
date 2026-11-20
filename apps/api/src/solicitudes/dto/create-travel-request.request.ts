// Body of POST /travel-requests (UC-01 steps 2 and 3): destination, dates, reason and, if needed, justification.
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** YYYY-MM-DD only: IsDateString alone would also accept a date with time. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const MAXIMUM_REASON_LENGTH = 255;
const MAXIMUM_JUSTIFICATION_LENGTH = 500;

export class CreateTravelRequestRequest {
  @IsInt()
  destinationId: number;

  /** D19: optional; without it S10 measures only against the destination. */
  @IsOptional()
  @IsInt()
  originId?: number;

  // A real calendar date (strict rejects 2026-02-30), without time: the column is `date`.
  @IsDateString({ strict: true })
  @Matches(CALENDAR_DATE, {
    message: 'startDate debe tener el formato AAAA-MM-DD',
  })
  startDate: string;

  @IsDateString({ strict: true })
  @Matches(CALENDAR_DATE, {
    message: 'endDate debe tener el formato AAAA-MM-DD',
  })
  endDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_REASON_LENGTH)
  reason: string;

  /** UC-01 4a: required only when the trip starts sooner than the policy's minimum advance. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_JUSTIFICATION_LENGTH)
  advanceJustification?: string;
}
