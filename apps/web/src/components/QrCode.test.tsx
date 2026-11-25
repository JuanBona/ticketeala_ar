// Checks that the QR is drawn as an image with a name screen readers can announce.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode } from './QrCode.js';

describe('QrCode', () => {
  it('draws the link as a named image', () => {
    render(<QrCode text="otpauth://totp/AMR%20Viajes:sintetico?secret=JBSWY3DP" label="QR de alta" size={132} />);

    const image = screen.getByRole('img', { name: 'QR de alta' });
    expect(image.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
  });
});
