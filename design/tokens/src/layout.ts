// Spacing, corner radii and minimum sizes of the alto-contraste style, in px.

/**
 * Spacing scale. The key is the step in units of 4 px (spacing[3] = 12 px), so a gap or padding
 * never uses a value off the scale. Half steps exist because the design uses 2, 6, 10, 14 and 18.
 */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  4.5: 18,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  16: 64,
} as const;

export const radii = {
  /** Progress bars and thin tracks. */
  hairline: 2,
  /** Small tags inside rows. */
  small: 8,
  /** Navigation items, rows and chips. */
  medium: 12,
  /** Logo badge, mobile back button, inner blocks. */
  large: 14,
  /** Inputs and list rows. */
  field: 16,
  /** Buttons. */
  button: 18,
  /** Inner cards. */
  card: 22,
  /** Main cards and bottom sheets. */
  panel: 28,
  /** Pills, segmented controls and badges. */
  pill: 999,
} as const;

/** Border widths: controls use 1.5 px of ink, the high-contrast signature of the style. */
export const borderWidths = {
  hairline: 1,
  control: 1.5,
} as const;

/** Minimum heights; touchTarget is the accessibility floor of CLAUDE.md (44 px). */
export const sizes = {
  touchTarget: 44,
  input: 54,
  button: 56,
} as const;
