// Encrypts TOTP secrets at rest with AES-256-GCM (12.4, D35): whoever reads the database cannot make codes.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { TOTP_ENCRYPTION_KEY_BYTES } from './auth.constants.js';

const ALGORITHM = 'aes-256-gcm';
const INITIALIZATION_VECTOR_BYTES = 12;
const AUTHENTICATION_TAG_BYTES = 16;

@Injectable()
export class TotpSecretCipher {
  private readonly key = readTotpEncryptionKey();

  /** Returns base64 of IV + tag + ciphertext; a 20-byte secret fits the 64 characters of totp_secret. */
  encrypt(secret: Uint8Array): string {
    const initializationVector = randomBytes(INITIALIZATION_VECTOR_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, initializationVector);
    const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
    return Buffer.concat([
      initializationVector,
      cipher.getAuthTag(),
      ciphertext,
    ]).toString('base64');
  }

  /** GCM checks the tag, so a ciphertext altered in the database fails instead of decrypting to garbage. */
  decrypt(stored: string): Uint8Array {
    const bytes = Buffer.from(stored, 'base64');
    const tagEnd = INITIALIZATION_VECTOR_BYTES + AUTHENTICATION_TAG_BYTES;
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      bytes.subarray(0, INITIALIZATION_VECTOR_BYTES),
    );
    decipher.setAuthTag(bytes.subarray(INITIALIZATION_VECTOR_BYTES, tagEnd));
    return Buffer.concat([
      decipher.update(bytes.subarray(tagEnd)),
      decipher.final(),
    ]);
  }
}

export function readTotpEncryptionKey(): Buffer {
  const encodedKey = process.env.TOTP_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error(
      'Falta TOTP_ENCRYPTION_KEY: copiá apps/api/.env.example a apps/api/.env',
    );
  }
  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== TOTP_ENCRYPTION_KEY_BYTES) {
    throw new Error(
      `TOTP_ENCRYPTION_KEY tiene ${key.length} bytes; hacen falta ${TOTP_ENCRYPTION_KEY_BYTES} (generala con: openssl rand -base64 32)`,
    );
  }
  return key;
}
