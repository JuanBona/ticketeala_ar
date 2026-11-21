// Body of POST /travel-requests/:id/rejection (UC-01 12a): the reason the employee will read.
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAXIMUM_REASON_LENGTH = 500;

export class RejectRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_REASON_LENGTH)
  reason: string;
}
