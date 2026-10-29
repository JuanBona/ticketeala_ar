// Unit tests of TotpSecretCipher (12.4, D35): AES-256-GCM encryption of TOTP secrets at rest.
import { randomBytes } from 'node:crypto';
import { TOTP_SECRET_BYTES } from './auth.constants.js';
import {
  readTotpEncryptionKey,
  TotpSecretCipher,
} from './totp-secret-cipher.js';

const TOTP_SECRET_COLUMN_LENGTH = 64;

describe('TotpSecretCipher', () => {
  beforeEach(() => {
    vi.stubEnv('TOTP_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('decrypts back to the same secret', () => {
    const cipher = new TotpSecretCipher();
    const secret = randomBytes(TOTP_SECRET_BYTES);

    expect(Buffer.from(cipher.decrypt(cipher.encrypt(secret)))).toEqual(secret);
  });

  it('D35: an encrypted secret fits the 64 characters of totp_secret', () => {
    const encrypted = new TotpSecretCipher().encrypt(
      randomBytes(TOTP_SECRET_BYTES),
    );

    expect(encrypted.length).toBeLessThanOrEqual(TOTP_SECRET_COLUMN_LENGTH);
  });

  it('encrypts the same secret differently each time', () => {
    const cipher = new TotpSecretCipher();
    const secret = randomBytes(TOTP_SECRET_BYTES);

    expect(cipher.encrypt(secret)).not.toBe(cipher.encrypt(secret));
  });

  it('refuses to decrypt a value altered in the database', () => {
    const cipher = new TotpSecretCipher();
    const stored = Buffer.from(
      cipher.encrypt(randomBytes(TOTP_SECRET_BYTES)),
      'base64',
    );
    stored[stored.length - 1] ^= 1;

    expect(() => cipher.decrypt(stored.toString('base64'))).toThrow();
  });

  it('refuses to decrypt with another key', () => {
    const stored = new TotpSecretCipher().encrypt(
      randomBytes(TOTP_SECRET_BYTES),
    );
    vi.stubEnv('TOTP_ENCRYPTION_KEY', randomBytes(32).toString('base64'));

    expect(() => new TotpSecretCipher().decrypt(stored)).toThrow();
  });
});

describe('readTotpEncryptionKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails when TOTP_ENCRYPTION_KEY is missing', () => {
    vi.stubEnv('TOTP_ENCRYPTION_KEY', '');

    expect(() => readTotpEncryptionKey()).toThrow('Falta TOTP_ENCRYPTION_KEY');
  });

  it('fails when the key is not 32 bytes and says its size', () => {
    vi.stubEnv('TOTP_ENCRYPTION_KEY', randomBytes(16).toString('base64'));

    expect(() => readTotpEncryptionKey()).toThrow(
      'TOTP_ENCRYPTION_KEY tiene 16 bytes; hacen falta 32',
    );
  });
});
