// Shadows of the alto-contraste style: hard offset shadows for actions, soft ones for cards.
import { colors, withAlpha } from './colors.js';

export interface ShadowLayer {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
}

/** A thin line under cards so they separate from the canvas even without the soft shadow. */
const cardEdge: ShadowLayer = { offsetX: 0, offsetY: 1, blur: 0, spread: 0, color: withAlpha(colors.ink, 0.06) };

function hardShadow(offset: number): ShadowLayer[] {
  return [{ offsetX: offset, offsetY: offset, blur: 0, spread: 0, color: colors.ink }];
}

/** Each shadow is a list of layers, so web (CSS) and mobile (boxShadow) read the same values. */
export const shadows = {
  /** Primary buttons ("Continuar", "Nueva solicitud"). Pressing moves the button onto its shadow. */
  hard: hardShadow(4),
  /** Small controls (segmented control, chips). */
  hardSmall: hardShadow(3),
  /** Emphasis cards (policy deviations). */
  hardLarge: hardShadow(6),
  card: [cardEdge, { offsetX: 0, offsetY: 20, blur: 40, spread: -24, color: withAlpha(colors.ink, 0.28) }],
  cardSmall: [cardEdge, { offsetX: 0, offsetY: 14, blur: 30, spread: -18, color: withAlpha(colors.ink, 0.25) }],
  /** Dark floating panels (policy summary on Mobile-Solicitud). */
  overlay: [{ offsetX: 0, offsetY: 30, blur: 60, spread: -30, color: withAlpha(colors.ink, 0.55) }],
  /** Bottom sheets: the shadow goes up. */
  sheet: [{ offsetX: 0, offsetY: -16, blur: 32, spread: -20, color: withAlpha(colors.ink, 0.35) }],
} as const satisfies Record<string, ShadowLayer[]>;

export type ShadowName = keyof typeof shadows;

/** Writes the layers as a CSS box-shadow value; React Native 0.76+ accepts the same string. */
export function toBoxShadow(layers: readonly ShadowLayer[]): string {
  return layers
    .map((layer) => `${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px ${layer.color}`)
    .join(', ');
}
