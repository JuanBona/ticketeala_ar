// Checks spacing and size tokens against the accessibility rules of CLAUDE.md.
import { describe, expect, it } from 'vitest';
import { sizes, spacing } from '../src/layout.js';

const SPACING_UNIT = 4;
const MINIMUM_TOUCH_TARGET = 44;

describe('sizes', () => {
  it('keeps every control at least as tall as the 44 px touch target', () => {
    const controlHeights = Object.values(sizes);

    expect(Math.min(...controlHeights)).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
  });
});

describe('spacing', () => {
  it('names each step by its multiple of 4 px', () => {
    for (const [step, pixels] of Object.entries(spacing)) {
      expect(pixels).toBe(Number(step) * SPACING_UNIT);
    }
  });
});
