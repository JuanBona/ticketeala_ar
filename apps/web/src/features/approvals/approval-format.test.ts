// Checks how the tray writes amounts, dates, initials and the policy chip.
import { describe, expect, it } from 'vitest';
import { OVER_CAP_APPROVAL, syntheticApproval } from '../../test/synthetic-approvals.js';
import { formatAmount, formatDateRange, initialsOf, nightsLabel, policyStatus } from './approval-format.js';

describe('formatAmount', () => {
  it('writes pesos with thousands dots and no cents when they are zero', () => {
    expect(formatAmount('354000.00', 'ARS')).toBe('$ 354.000');
  });

  it('keeps the cents when there are some', () => {
    expect(formatAmount('48320.50', 'ARS')).toBe('$ 48.320,5');
  });
});

describe('formatDateRange', () => {
  it('writes the month once when the trip stays in one month', () => {
    expect(formatDateRange('2026-12-09', '2026-12-11')).toBe('9–11 dic');
  });

  it('writes both months when the trip crosses months', () => {
    expect(formatDateRange('2026-11-28', '2026-12-02')).toBe('28 nov – 2 dic');
  });
});

describe('initialsOf', () => {
  it('takes first and last name, ignoring the synthetic mark', () => {
    expect(initialsOf('Camila Acosta (sintético)')).toBe('CA');
  });
});

describe('policyStatus', () => {
  it('is within policy when the chosen quote does not exceed the cap (RN01)', () => {
    expect(policyStatus(syntheticApproval())).toEqual({ withinPolicy: true });
  });

  it('gives the excess over the cap as a percentage rounded up (9a)', () => {
    expect(policyStatus(OVER_CAP_APPROVAL)).toEqual({ withinPolicy: false, excessPercent: 18 });
  });
});

describe('nightsLabel', () => {
  it('uses the singular for one night', () => {
    expect(nightsLabel(1)).toBe('1 noche');
  });
});
