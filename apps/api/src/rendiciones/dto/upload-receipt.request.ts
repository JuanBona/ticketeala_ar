// Body of POST /expenses (UC-02 steps 2 and 3): the photo plus what the employee declares about it.
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { ExpenseCategory } from '../../generated/prisma/enums.js';
import { ExpenseCategory as Category } from '../../generated/prisma/enums.js';

/** D27: the employee picks the expense type; names as in verifier.schema.json (TipoGasto). */
export const EXPENSE_TYPE_NAMES = [
  'alojamiento',
  'transporte',
  'comida',
  'otros',
] as const;

export type ExpenseTypeName = (typeof EXPENSE_TYPE_NAMES)[number];

export const CATEGORY_BY_EXPENSE_TYPE: Record<
  ExpenseTypeName,
  ExpenseCategory
> = {
  alojamiento: Category.LODGING,
  transporte: Category.TRANSPORT,
  comida: Category.MEALS,
  otros: Category.OTHER,
};

const MAXIMUM_LATITUDE = 90;
const MAXIMUM_LONGITUDE = 180;
/** D31: ISO 4217 code, three capital letters. */
const CURRENCY_CODE = /^[A-Z]{3}$/;

/** Both coordinates travel together: sending only one is an error, not "no location". */
const hasAnyCoordinate = (request: UploadReceiptRequest): boolean =>
  request.latitude !== undefined || request.longitude !== undefined;

// Multipart sends every field as text; @Type turns the numbers back into numbers before validating.
export class UploadReceiptRequest {
  /** The photo, in the `image` part of the multipart body. JPEG or PNG, up to 10 MB. */
  @ApiProperty({ type: 'string', format: 'binary' })
  // Listed only for the contract: multer takes the file out of the body, and the service checks it.
  // IsOptional keeps the ValidationPipe from rejecting the empty `image` field of the class.
  @IsOptional()
  image: unknown;

  /** UC-02 precondition: an approved request of the logged-in employee. */
  @Type(() => Number)
  @IsInt()
  travelRequestId: number;

  @ApiProperty({ enum: EXPENSE_TYPE_NAMES })
  @IsIn(EXPENSE_TYPE_NAMES)
  expenseType: ExpenseTypeName;

  /** D31: ISO 4217. Defaults to ARS. */
  @ApiProperty({ required: false, default: 'ARS' })
  @IsOptional()
  @Matches(CURRENCY_CODE, { message: 'currency debe ser un código ISO 4217' })
  currency?: string;

  /** UC-02 step 2 and 2a: omit latitude and longitude if the employee did not allow the location. */
  @ApiProperty({ required: false })
  @ValidateIf(hasAnyCoordinate)
  @Type(() => Number)
  @IsNumber()
  @Min(-MAXIMUM_LATITUDE)
  @Max(MAXIMUM_LATITUDE)
  latitude?: number;

  @ApiProperty({ required: false })
  @ValidateIf(hasAnyCoordinate)
  @Type(() => Number)
  @IsNumber()
  @Min(-MAXIMUM_LONGITUDE)
  @Max(MAXIMUM_LONGITUDE)
  longitude?: number;

  /** UC-02 step 2: when the phone took the photo (ISO 8601). */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601({ strict: true })
  capturedAt?: string;
}
