// Turns the tokens into CSS custom properties (--color-ink, --space-3…) for apps/web.
import { colors } from './colors.js';
import { borderWidths, radii, sizes, spacing } from './layout.js';
import { easings, motion, reducedMotion, toCubicBezier, type MotionTimings } from './motion.js';
import { shadows, toBoxShadow } from './shadows.js';
import {
  fontFallbacks,
  fontFamilies,
  fontSizes,
  fluidFontSizes,
  textStyles,
  type FontRole,
  type FontSize,
} from './typography.js';

type Declarations = Array<[name: string, value: string]>;

function toKebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace('.', '-').toLowerCase();
}

function prefixed(prefix: string, values: Record<string, string | number>, unit = ''): Declarations {
  return Object.entries(values).map(([name, value]) => [`--${prefix}-${toKebabCase(name)}`, `${value}${unit}`]);
}

function fontStack(role: FontRole): string {
  return `'${fontFamilies[role]}', ${fontFallbacks[role]}`;
}

function cssFontSize(size: FontSize): string {
  if (typeof size === 'number') {
    return `${size}px`;
  }
  return `clamp(${size.minimum}px, ${size.viewportWidthPercent}vw, ${size.maximum}px)`;
}

function textStyleDeclarations(): Declarations {
  return Object.entries(textStyles).flatMap(([name, style]): Declarations => {
    const prefix = `--text-${toKebabCase(name)}`;
    return [
      [`${prefix}-family`, `var(--font-${style.family})`],
      [`${prefix}-size`, cssFontSize(style.size)],
      [`${prefix}-weight`, String(style.weight)],
      [`${prefix}-line-height`, String(style.lineHeight)],
      [`${prefix}-letter-spacing`, `${style.letterSpacingEm}em`],
      [`${prefix}-transform`, 'uppercase' in style ? 'uppercase' : 'none'],
    ];
  });
}

function motionDeclarations(timings: MotionTimings): Declarations {
  return [...prefixed('duration', timings.durations, 'ms'), ['--motion-list-stagger', `${timings.listStaggerMs}ms`]];
}

/** JavaScript lists whole-number keys before "0.5"; sorting keeps the scale readable in the CSS. */
function spacingDeclarations(): Declarations {
  return Object.entries(spacing)
    .sort(([, first], [, second]) => first - second)
    .map(([step, pixels]) => [`--space-${toKebabCase(step)}`, `${pixels}px`]);
}

function tokenDeclarations(): Declarations {
  const fontFamilyDeclarations: Declarations = (Object.keys(fontFamilies) as FontRole[]).map((role) => [
    `--font-${role}`,
    fontStack(role),
  ]);
  const shadowDeclarations: Declarations = Object.entries(shadows).map(([name, layers]) => [
    `--shadow-${toKebabCase(name)}`,
    toBoxShadow(layers),
  ]);
  const easingDeclarations: Declarations = Object.entries(easings).map(([name, easing]) => [
    `--easing-${name}`,
    toCubicBezier(easing),
  ]);
  return [
    ...prefixed('color', colors),
    ...fontFamilyDeclarations,
    ...prefixed('font-size', fontSizes, 'px'),
    ...Object.entries(fluidFontSizes).map(([name, size]): [string, string] => [`--font-size-${name}`, cssFontSize(size)]),
    ...textStyleDeclarations(),
    ...spacingDeclarations(),
    ...prefixed('radius', radii, 'px'),
    ...prefixed('border', borderWidths, 'px'),
    ...prefixed('size', sizes, 'px'),
    ...shadowDeclarations,
    ...motionDeclarations(motion),
    ...easingDeclarations,
  ];
}

function block(selector: string, declarations: Declarations, indent = ''): string {
  const lines = declarations.map(([name, value]) => `${indent}  ${name}: ${value};`);
  return [`${indent}${selector} {`, ...lines, `${indent}}`].join('\n');
}

/** The whole tokens.css: tokens on :root, and every duration at 0 ms when the user reduces motion. */
export function buildTokensCss(): string {
  const header = '/* Generated from design/tokens/src by `npm run build:css`. Do not edit by hand. */';
  const reducedMotionBlock = [
    '@media (prefers-reduced-motion: reduce) {',
    block(':root', motionDeclarations(reducedMotion), '  '),
    '}',
  ].join('\n');
  return [header, block(':root', tokenDeclarations()), reducedMotionBlock].join('\n\n') + '\n';
}
