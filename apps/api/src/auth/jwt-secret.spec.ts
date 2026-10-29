// Unit tests of readJwtSecret (D34): the API refuses to start without a strong signing secret.
import { readJwtSecret } from './jwt-secret.js';

describe('readJwtSecret', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails when JWT_SECRET is missing', () => {
    vi.stubEnv('JWT_SECRET', '');

    expect(() => readJwtSecret()).toThrow('Falta JWT_SECRET');
  });

  it('fails when JWT_SECRET is shorter than 32 characters and says its length', () => {
    vi.stubEnv('JWT_SECRET', 'corto');

    expect(() => readJwtSecret()).toThrow(
      'JWT_SECRET tiene 5 caracteres; hacen falta al menos 32',
    );
  });

  it('returns a secret of 32 characters or more', () => {
    const strongSecret = 'a'.repeat(32);
    vi.stubEnv('JWT_SECRET', strongSecret);

    expect(readJwtSecret()).toBe(strongSecret);
  });
});
