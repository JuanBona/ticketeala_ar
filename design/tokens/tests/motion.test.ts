// Checks the motion tokens: short animations and everything off with reduced motion.
import { describe, expect, it } from 'vitest';
import { easings, motion, reducedMotion, toCubicBezier } from '../src/motion.js';

/** Upper limit the team set so an animation never makes the user wait for the next action. */
const LONGEST_ALLOWED_DURATION_MS = 500;

describe('motion', () => {
  it('keeps every animation under half a second', () => {
    expect(Math.max(...Object.values(motion.durations))).toBeLessThanOrEqual(LONGEST_ALLOWED_DURATION_MS);
  });

  it('turns every duration and the list stagger off with reduced motion', () => {
    expect(Object.values(reducedMotion.durations).every((duration) => duration === 0)).toBe(true);
    expect(reducedMotion.listStaggerMs).toBe(0);
  });

  it('has a reduced value for every duration', () => {
    expect(Object.keys(reducedMotion.durations)).toEqual(Object.keys(motion.durations));
  });
});

describe('toCubicBezier', () => {
  it('writes the curve as a CSS timing function', () => {
    expect(toCubicBezier(easings.enter)).toBe('cubic-bezier(0.05, 0.7, 0.1, 1)');
  });
});
