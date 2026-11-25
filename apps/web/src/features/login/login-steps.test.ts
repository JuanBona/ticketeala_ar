// Checks which Login step follows each API answer (RN30, D35, D36).
import { describe, expect, it } from 'vitest';
import { SYNTHETIC_TOKENS } from '../../test/fake-api.js';
import { manualEntryKey, outcomeOfLogin, outcomeOfVerification } from './login-steps.js';

describe('outcomeOfLogin', () => {
  it('signs in an employee without an RN30 role', () => {
    const outcome = outcomeOfLogin({ step: 'authenticated', ...SYNTHETIC_TOKENS });

    expect(outcome).toEqual({ kind: 'signedIn', tokens: SYNTHETIC_TOKENS });
  });

  it('asks the app code when the second factor is already set up', () => {
    const outcome = outcomeOfLogin({ step: 'totp_required', challengeToken: 'desafio' });

    expect(outcome).toEqual({ kind: 'nextStep', step: { name: 'totp', challengeToken: 'desafio' } });
  });

  it('starts the setup when the second factor is missing (D36)', () => {
    const outcome = outcomeOfLogin({ step: 'totp_enrollment_required', challengeToken: 'desafio' });

    expect(outcome).toEqual({ kind: 'nextStep', step: { name: 'enrollmentCode', challengeToken: 'desafio' } });
  });

  it('rejects an "authenticated" answer without tokens', () => {
    expect(() => outcomeOfLogin({ step: 'authenticated' })).toThrow('sin tokens');
  });
});

describe('outcomeOfVerification', () => {
  it('signs in when the code brings no recovery codes', () => {
    expect(outcomeOfVerification(SYNTHETIC_TOKENS)).toEqual({ kind: 'signedIn', tokens: SYNTHETIC_TOKENS });
  });

  it('shows the recovery codes after a setup before signing in (D36)', () => {
    const outcome = outcomeOfVerification({ ...SYNTHETIC_TOKENS, recoveryCodes: ['ABCD-EFGH-JKLM-NPQR'] });

    expect(outcome).toEqual({
      kind: 'nextStep',
      step: { name: 'recoveryCodes', recoveryCodes: ['ABCD-EFGH-JKLM-NPQR'], tokens: SYNTHETIC_TOKENS },
    });
  });
});

describe('manualEntryKey', () => {
  it('groups the secret of the otpauth link by 4', () => {
    const key = manualEntryKey('otpauth://totp/AMR%20Viajes:sintetico?secret=JBSWY3DPEHPK3PXP&issuer=AMR%20Viajes');

    expect(key).toBe('JBSW Y3DP EHPK 3PXP');
  });
});
