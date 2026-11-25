// WCAG 2.2 contrast ratio between two colors, used by the color tests.
import { parseHexColor } from '../src/colors.js';

const CHANNEL_MAXIMUM = 255;
/** Constants of the sRGB relative luminance formula in WCAG 2.2. */
const LINEAR_THRESHOLD = 0.04045;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_EXPONENT = 2.4;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const FLARE = 0.05;

function linearChannel(channel: number): number {
  const unit = channel / CHANNEL_MAXIMUM;
  if (unit <= LINEAR_THRESHOLD) {
    return unit / LINEAR_DIVISOR;
  }
  return ((unit + GAMMA_OFFSET) / (1 + GAMMA_OFFSET)) ** GAMMA_EXPONENT;
}

function relativeLuminance(hexColor: string): number {
  return parseHexColor(hexColor)
    .map(linearChannel)
    .reduce((sum, channel, index) => sum + channel * (LUMINANCE_WEIGHTS[index] ?? 0), 0);
}

/** From 1 (same color) to 21 (black on white). */
export function contrastRatio(firstColor: string, secondColor: string): number {
  const [lighter, darker] = [relativeLuminance(firstColor), relativeLuminance(secondColor)].sort(
    (first, second) => second - first,
  );
  return ((lighter ?? 0) + FLARE) / ((darker ?? 0) + FLARE);
}
