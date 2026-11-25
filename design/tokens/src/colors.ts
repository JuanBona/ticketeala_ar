// Colors of the alto-contraste style, named by role, and the text/background pairs allowed (contrast AA).

/** Every color used in design/html/alto-contraste, named by what it does on screen. */
export const colors = {
  /** Main text, dark panels (sidebar, hero card), borders of controls and the hard shadow. */
  ink: '#0F1210',
  /** Secondary text on light surfaces. */
  inkSoft: '#3A3F37',
  /** Labels, eyebrows and tertiary text on light surfaces. */
  inkMuted: '#50554D',
  /** Page background. */
  canvas: '#E9EBE4',
  /** Cards, inputs and sheets. */
  surface: '#F7F8F4',
  /** Rows and blocks inside a card (one step below the card). */
  surfaceSunken: '#ECEEE8',
  /** Pressed or selected rows, progress tracks on light surfaces. */
  surfaceStrong: '#DDE0D7',
  /** Text on dark panels. */
  onInk: '#F2F3EF',
  /** Navigation text on dark panels. */
  onInkSoft: '#E3E6DD',
  /** Secondary text on dark panels. */
  onInkMuted: '#A9AEA3',
  /** Raised blocks inside a dark panel (user card, approver card). */
  inkRaised: '#1C201C',
  /** Progress tracks inside a dark panel. */
  inkTrack: '#262B26',
  /** Dividers inside a dark panel. */
  inkDivider: '#2B302B',
  /** Text on raised blocks inside a dark panel. */
  onInkRaised: '#C9CDC2',
  /** Brand accent: primary buttons, "within policy", highlighted numbers on dark panels. */
  accent: '#C8F05A',
  /** Alert background: policy deviations, engine alerts, blocking signals. Never as text on light. */
  alert: '#FF6A3D',
  /** Alert text on dark panels (negative balances). */
  alertOnInk: '#FFB199',
  /** Pure white: avatar backgrounds on dark panels. */
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;

export interface TextPair {
  text: ColorName;
  background: ColorName;
}

/**
 * Text/background pairs the screens may use. All reach WCAG AA (4.5:1) for small text,
 * which the tests check. Alert as text on a light surface reaches only 2.67:1, so it is left out.
 */
export const allowedTextPairs: readonly TextPair[] = [
  { text: 'ink', background: 'canvas' },
  { text: 'ink', background: 'surface' },
  { text: 'ink', background: 'surfaceSunken' },
  { text: 'ink', background: 'surfaceStrong' },
  { text: 'ink', background: 'accent' },
  { text: 'ink', background: 'alert' },
  { text: 'inkSoft', background: 'canvas' },
  { text: 'inkSoft', background: 'surface' },
  { text: 'inkSoft', background: 'surfaceSunken' },
  { text: 'inkMuted', background: 'canvas' },
  { text: 'inkMuted', background: 'surface' },
  { text: 'inkMuted', background: 'surfaceSunken' },
  { text: 'onInk', background: 'ink' },
  { text: 'onInkSoft', background: 'ink' },
  { text: 'onInkMuted', background: 'ink' },
  { text: 'onInkMuted', background: 'inkRaised' },
  { text: 'onInkRaised', background: 'inkRaised' },
  { text: 'accent', background: 'ink' },
  { text: 'alertOnInk', background: 'ink' },
  { text: 'ink', background: 'white' },
];

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const HEX_CHANNEL_POSITIONS = [1, 3, 5] as const;

export type RgbChannels = [red: number, green: number, blue: number];

/** Reads a #RRGGBB color into its red, green and blue channels (0–255). */
export function parseHexColor(hexColor: string): RgbChannels {
  if (!HEX_COLOR_PATTERN.test(hexColor)) {
    throw new Error(`Color inválido: "${hexColor}" no tiene el formato #RRGGBB`);
  }
  const [red = 0, green = 0, blue = 0] = HEX_CHANNEL_POSITIONS.map((position) =>
    parseInt(hexColor.slice(position, position + 2), 16),
  );
  return [red, green, blue];
}

/** Writes a #RRGGBB color as rgba() with the given opacity (0–1); the soft shadows need it. */
export function withAlpha(hexColor: string, alpha: number): string {
  if (alpha < 0 || alpha > 1) {
    throw new Error(`Opacidad inválida: ${alpha} para ${hexColor}; tiene que estar entre 0 y 1`);
  }
  return `rgba(${parseHexColor(hexColor).join(',')},${alpha})`;
}
