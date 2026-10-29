// Unit tests of the D36 one-time code format and hashing.
import {
  generateSecondFactorCode,
  hashSecondFactorCode,
} from './second-factor-codes.js';

describe('second factor codes', () => {
  it('D36: a code has four groups of four base32 characters', () => {
    expect(generateSecondFactorCode()).toMatch(
      /^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/,
    );
  });

  it('D36: two codes are never the same', () => {
    expect(generateSecondFactorCode()).not.toBe(generateSecondFactorCode());
  });

  it('D36: the hash ignores lowercase, dashes and spaces', () => {
    expect(hashSecondFactorCode('abcd efgh-ijkl-mnop')).toBe(
      hashSecondFactorCode('ABCD-EFGH-IJKL-MNOP'),
    );
  });

  it('D36: the hash never contains the code itself', () => {
    const code = generateSecondFactorCode();

    expect(hashSecondFactorCode(code)).not.toContain(code.replace(/-/g, ''));
  });
});
