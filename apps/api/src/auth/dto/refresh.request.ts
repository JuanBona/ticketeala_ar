// Body of POST /auth/refresh and POST /auth/logout: the refresh token issued at login (D34).
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAXIMUM_REFRESH_TOKEN_LENGTH = 128;

export class RefreshRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_REFRESH_TOKEN_LENGTH)
  refreshToken: string;
}
