// Checks the color tokens: AA contrast of every allowed pair and the hex helpers.
import { describe, expect, it } from 'vitest';
import { allowedTextPairs, colors, parseHexColor, withAlpha } from '../src/colors.js';
import { contrastRatio } from './contrast.js';

/** WCAG 2.2 AA minimum for normal-size text (criterion 1.4.3). */
const WCAG_AA_NORMAL_TEXT = 4.5;

describe('allowedTextPairs', () => {
  it.each(allowedTextPairs)('$text on $background reaches AA contrast', ({ text, background }) => {
    const ratio = contrastRatio(colors[text], colors[background]);

    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('leaves out alert as text on a light surface, which fails AA', () => {
    const ratio = contrastRatio(colors.alert, colors.surface);

    expect(ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT);
    expect(allowedTextPairs).not.toContainEqual({ text: 'alert', background: 'surface' });
  });
});

describe('parseHexColor', () => {
  it('reads the red, green and blue channels', () => {
    expect(parseHexColor('#C8F05A')).toEqual([200, 240, 90]);
  });

  it('rejects a color without six hex digits and names it', () => {
    expect(() => parseHexColor('#FFF')).toThrow('Color inválido: "#FFF"');
  });
});

describe('withAlpha', () => {
  it('writes ink with opacity as rgba', () => {
    expect(withAlpha(colors.ink, 0.28)).toBe('rgba(15,18,16,0.28)');
  });

  it('rejects an opacity above 1 and names it', () => {
    expect(() => withAlpha(colors.ink, 28)).toThrow('Opacidad inválida: 28');
  });
});
