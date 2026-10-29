// Reads the JWT signing secret from the environment and refuses to start with a weak one.
import { MINIMUM_JWT_SECRET_LENGTH } from './auth.constants.js';

export function readJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Falta JWT_SECRET: copiá apps/api/.env.example a apps/api/.env',
    );
  }
  if (secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET tiene ${secret.length} caracteres; hacen falta al menos ${MINIMUM_JWT_SECRET_LENGTH}`,
    );
  }
  return secret;
}
