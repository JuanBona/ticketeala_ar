// Checks that shadows are written as valid CSS / React Native box-shadow strings.
import { describe, expect, it } from 'vitest';
import { shadows, toBoxShadow } from '../src/shadows.js';

describe('toBoxShadow', () => {
  it('writes the hard shadow of primary buttons as in the design', () => {
    expect(toBoxShadow(shadows.hard)).toBe('4px 4px 0px 0px #0F1210');
  });

  it('joins the layers of the card shadow with commas', () => {
    expect(toBoxShadow(shadows.card)).toBe(
      '0px 1px 0px 0px rgba(15,18,16,0.06), 0px 20px 40px -24px rgba(15,18,16,0.28)',
    );
  });
});
