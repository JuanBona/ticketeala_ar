// Bodies of the second factor endpoints (RN30, D36). The challenge token always comes from step 1.
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const MAXIMUM_CHALLENGE_TOKEN_LENGTH = 1024;
/** 16 letters or digits, with optional dashes or spaces between groups (e.g. ABCD-EFGH-JKLM-NPQR). */
const ONE_TIME_CODE_FORMAT = /^[A-Za-z0-9][A-Za-z0-9 -]{14,22}[A-Za-z0-9]$/;

class ChallengeRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_CHALLENGE_TOKEN_LENGTH)
  challengeToken: string;
}

/** POST /auth/totp/enroll: the enrollment code an administrator handed over. */
export class StartEnrollmentRequest extends ChallengeRequest {
  @Matches(ONE_TIME_CODE_FORMAT, {
    message: 'enrollmentCode no tiene el formato ABCD-EFGH-JKLM-NPQR',
  })
  enrollmentCode: string;
}

/** POST /auth/totp/verify: the 6 digits the authenticator app shows. */
export class VerifyTotpRequest extends ChallengeRequest {
  @Matches(/^\d{6}$/, { message: 'code debe tener 6 dígitos' })
  code: string;
}

/** POST /auth/totp/recover: one of the recovery codes given at enrollment. */
export class RecoverRequest extends ChallengeRequest {
  @Matches(ONE_TIME_CODE_FORMAT, {
    message: 'recoveryCode no tiene el formato ABCD-EFGH-JKLM-NPQR',
  })
  recoveryCode: string;
}

/** POST /auth/totp/enrollment-codes: whose second factor the administrator resets. */
export class IssueEnrollmentCodeRequest {
  // JSON numbers arrive as numbers, but this also accepts "1002" and converts it.
  @Type(() => Number)
  @IsInt()
  employeeNumber: number;
}
