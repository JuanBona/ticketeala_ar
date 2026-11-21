// Response of POST /expenses (UC-02 step 3): the expense created and where it stands.
import { ApiProperty } from '@nestjs/swagger';

/** D25: the states of an expense against the verification engine, as the apps know them. */
export const VERIFICATION_STATUS_NAMES = [
  'pendiente',
  'verificado',
  'imagen_rechazada',
  'duplicado_rechazado',
  'error',
] as const;

export class ReceiptUploadResponse {
  expenseId: number;
  expenseReportId: number;
  @ApiProperty({ enum: VERIFICATION_STATUS_NAMES })
  verificationStatus: (typeof VERIFICATION_STATUS_NAMES)[number];
  /** D25: photos already rejected for this expense (N of D21). */
  imageAttempts: number;
}
