// Body of POST /auth/login: institutional email and password (Login screen, step 1 of 2).
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Caps the work argon2 does per request; no real password is this long. */
const MAXIMUM_PASSWORD_LENGTH = 256;
const MAXIMUM_EMAIL_LENGTH = 150;

export class LoginRequest {
  // Emails are stored lowercase; users often type them with capitals or a trailing space.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(MAXIMUM_EMAIL_LENGTH)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAXIMUM_PASSWORD_LENGTH)
  password: string;
}
