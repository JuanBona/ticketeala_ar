// Unit tests of the quote rules: expiry (RN11), cap (9a, 5a) and savings against the external reference.
import { Prisma } from '../generated/prisma/client.js';
import { exceedsCap, isExpired, savingsAgainst } from './quote-rules.js';

const money = (amount: string) => new Prisma.Decimal(amount);

describe('quote rules', () => {
  it('RN11: a fare valid until yesterday has expired', () => {
    expect(isExpired('2026-11-20', '2026-11-21')).toBe(true);
  });

  it('RN11: a fare valid until today can still be selected', () => {
    expect(isExpired('2026-11-21', '2026-11-21')).toBe(false);
  });

  it('RN11: a quote without validity date never expires', () => {
    expect(isExpired(null, '2026-11-21')).toBe(false);
  });

  it('9a: exactly the cap is within the cap', () => {
    expect(exceedsCap(money('250000.00'), money('250000.00'))).toBe(false);
  });

  it('9a: one cent over the cap exceeds it', () => {
    expect(exceedsCap(money('250000.01'), money('250000.00'))).toBe(true);
  });

  it('UC-03 step 10: savings are the external reference minus the agency amount', () => {
    expect(
      savingsAgainst(money('180000.00'), money('200000.00'))?.toFixed(2),
    ).toBe('20000.00');
  });

  it('UC-03 step 10: without an external reference there are no savings to show', () => {
    expect(savingsAgainst(money('180000.00'), null)).toBeNull();
  });
});
