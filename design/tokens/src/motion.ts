// Animation durations and curves. The reference HTML has none: these are the team's definition.

/** In milliseconds. Short on purpose: animations accompany the action, they never block it. */
export const durations = {
  /** Press feedback: a button sinking onto its shadow. */
  instant: 80,
  /** Hover, focus, toggles and chips. */
  fast: 150,
  /** Cards and list rows entering, skeletons fading into content. */
  base: 220,
  /** Screen transitions and bottom sheets. */
  slow: 320,
  /** Confirmations: request approved, report submitted, engine result revealed. */
  emphasis: 480,
} as const;

export type DurationName = keyof typeof durations;

/** Cubic Bézier control points [x1, y1, x2, y2]; values from Material Design 3 motion. */
export type CubicBezier = readonly [number, number, number, number];

export const easings = {
  /** Movements inside the screen (hover, toggles). */
  standard: [0.2, 0, 0, 1],
  /** Something that appears: starts fast and settles. */
  enter: [0.05, 0.7, 0.1, 1],
  /** Something that leaves: starts slow and accelerates out. */
  exit: [0.3, 0, 0.8, 0.15],
} as const satisfies Record<string, CubicBezier>;

export type EasingName = keyof typeof easings;

export interface MotionTimings {
  durations: Record<DurationName, number>;
  /** Gap in ms between consecutive list items entering, so a list reads top to bottom. */
  listStaggerMs: number;
}

export const motion: MotionTimings = { durations, listStaggerMs: 40 };

/**
 * With "reduce motion" on (prefers-reduced-motion on the web, the system setting on mobile)
 * every animation is turned off: the state changes at once.
 */
export const reducedMotion: MotionTimings = {
  durations: { instant: 0, fast: 0, base: 0, slow: 0, emphasis: 0 },
  listStaggerMs: 0,
};

export function toCubicBezier(easing: CubicBezier): string {
  return `cubic-bezier(${easing.join(', ')})`;
}
