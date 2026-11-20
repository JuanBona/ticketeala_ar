// Unit tests of the UC-01 pure rules: days, nights (D11), minimum advance (4a) and allowance (D03).
import { Prisma } from '../generated/prisma/client.js';
import {
  daysBetween,
  estimateAllowance,
  missesMinimumAdvance,
  todayInArgentina,
} from './travel-request-rules.js';

describe('UC-01 rules', () => {
  it('D11: from the 24th to the 27th there are 3 nights', () => {
    expect(daysBetween('2026-11-24', '2026-11-27')).toBe(3);
  });

  it('counts days across a month change', () => {
    expect(daysBetween('2026-11-30', '2026-12-02')).toBe(2);
  });

  it('uses the Argentine date: 01:00 UTC is still the previous day in Rosario', () => {
    expect(todayInArgentina(new Date('2026-11-21T01:00:00Z'))).toBe(
      '2026-11-20',
    );
  });

  it('4a: starting in 3 days misses a 5-day minimum advance', () => {
    expect(missesMinimumAdvance('2026-11-20', '2026-11-23', 5)).toBe(true);
  });

  it('4a: starting exactly on the minimum advance is enough', () => {
    expect(missesMinimumAdvance('2026-11-20', '2026-11-25', 5)).toBe(false);
  });

  it('D03: the estimate is the daily allowance times the nights, without float errors', () => {
    const estimate = estimateAllowance(new Prisma.Decimal('10000.10'), 3);

    expect(estimate.toFixed(2)).toBe('30000.30');
  });
});
