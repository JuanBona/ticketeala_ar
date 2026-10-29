// Body of POST /auth/totp/verify (RN30): the challenge from step 1 and the 6-digit code of the app.
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const MAXIMUM_CHALLENGE_TOKEN_LENGTH = 1024;

export class VerifyTotpRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_CHALLENGE_TOKEN_LENGTH)
  challengeToken: string;

  @Matches(/^\d{6}$/, { message: 'code debe tener 6 dígitos' })
  code: string;
}
