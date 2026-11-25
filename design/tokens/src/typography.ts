// Font families, sizes and the named text styles of the alto-contraste style.

/** Family names; the font files live in design/html/fonts (Bricolage, Geist, GeistMono). */
export const fontFamilies = {
  /** Titles and big numbers in headings ("Nueva solicitud.", "Gasto en viajes"). */
  display: 'Bricolage Grotesque',
  /** Body text, buttons and inputs. */
  body: 'Geist',
  /** Eyebrows, labels, amounts, dates and codes (CUIT, CAE, R-0418). */
  mono: 'Geist Mono',
} as const;

/** Fallbacks while the font loads or if it fails. */
export const fontFallbacks = {
  display: 'sans-serif',
  body: 'system-ui, sans-serif',
  mono: 'monospace',
} as const;

export type FontRole = keyof typeof fontFamilies;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

/** Sizes in px, from the most repeated values of the reference HTML. */
export const fontSizes = {
  caption: 11,
  small: 12,
  footnote: 13,
  bodySmall: 14,
  body: 15,
  bodyLarge: 16,
  titleSmall: 18,
  title: 24,
  titleLarge: 32,
  headline: 44,
} as const;

/** Sizes that grow with the screen width on the web; mobile uses the minimum. */
export interface FluidFontSize {
  minimum: number;
  viewportWidthPercent: number;
  maximum: number;
}

export const fluidFontSizes = {
  /** Page titles of the web panel ("Gasto en viajes, en tiempo real."). */
  display: { minimum: 36, viewportWidthPercent: 4.6, maximum: 64 },
  /** Hero of the Login screen. */
  hero: { minimum: 44, viewportWidthPercent: 6, maximum: 88 },
} as const satisfies Record<string, FluidFontSize>;

export type FontSize = number | FluidFontSize;

export interface TextStyle {
  family: FontRole;
  size: FontSize;
  weight: (typeof fontWeights)[keyof typeof fontWeights];
  /** Multiplier of the font size. */
  lineHeight: number;
  /** In em (fraction of the font size); mobile converts it to px. */
  letterSpacingEm: number;
  uppercase?: true;
}

/** Combinations that repeat across screens. Components use these, not loose sizes. */
export const textStyles = {
  hero: { family: 'display', size: fluidFontSizes.hero, weight: 800, lineHeight: 0.92, letterSpacingEm: -0.05 },
  display: { family: 'display', size: fluidFontSizes.display, weight: 800, lineHeight: 0.95, letterSpacingEm: -0.045 },
  headline: { family: 'display', size: fontSizes.headline, weight: 800, lineHeight: 0.95, letterSpacingEm: -0.045 },
  title: { family: 'display', size: fontSizes.title, weight: 700, lineHeight: 1.05, letterSpacingEm: -0.03 },
  titleSmall: { family: 'display', size: fontSizes.titleSmall, weight: 700, lineHeight: 1.05, letterSpacingEm: -0.02 },
  body: { family: 'body', size: fontSizes.body, weight: 400, lineHeight: 1.45, letterSpacingEm: 0 },
  bodyStrong: { family: 'body', size: fontSizes.body, weight: 600, lineHeight: 1.45, letterSpacingEm: 0 },
  bodySmall: { family: 'body', size: fontSizes.bodySmall, weight: 400, lineHeight: 1.4, letterSpacingEm: 0 },
  button: { family: 'body', size: fontSizes.bodyLarge, weight: 600, lineHeight: 1, letterSpacingEm: 0 },
  eyebrow: { family: 'mono', size: fontSizes.small, weight: 500, lineHeight: 1.4, letterSpacingEm: 0.12, uppercase: true },
  label: { family: 'mono', size: fontSizes.caption, weight: 500, lineHeight: 1.4, letterSpacingEm: 0.1, uppercase: true },
  amount: { family: 'mono', size: fontSizes.titleSmall, weight: 500, lineHeight: 1.2, letterSpacingEm: 0 },
  code: { family: 'mono', size: fontSizes.small, weight: 500, lineHeight: 1.4, letterSpacingEm: 0.08 },
} as const satisfies Record<string, TextStyle>;

export type TextStyleName = keyof typeof textStyles;
