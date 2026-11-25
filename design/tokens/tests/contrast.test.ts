// Checks the contrast helper against the known WCAG extremes.
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast.js';

describe('contrastRatio', () => {
  it('gives 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
  });

  it('gives 1 for a color on itself', () => {
    expect(contrastRatio('#C8F05A', '#C8F05A')).toBe(1);
  });
});
