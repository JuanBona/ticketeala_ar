// Checks tokens.css: in sync with the TypeScript tokens, and motion off with prefers-reduced-motion.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTokensCss } from '../src/css-variables.js';

const committedCss = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');

describe('buildTokensCss', () => {
  it('matches the committed tokens.css (run `npm run build:css` if this fails)', () => {
    expect(committedCss).toBe(buildTokensCss());
  });

  it('declares colors in kebab case', () => {
    expect(buildTokensCss()).toContain('--color-ink-muted: #50554D;');
  });

  it('writes fluid sizes with clamp()', () => {
    expect(buildTokensCss()).toContain('--font-size-display: clamp(36px, 4.6vw, 64px);');
  });

  it('names half spacing steps with a dash', () => {
    expect(buildTokensCss()).toContain('--space-0-5: 2px;');
  });

  it('sets durations to 0 ms inside prefers-reduced-motion', () => {
    const reducedBlock = buildTokensCss().split('@media (prefers-reduced-motion: reduce)')[1] ?? '';

    expect(reducedBlock).toContain('--duration-emphasis: 0ms;');
    expect(reducedBlock).toContain('--motion-list-stagger: 0ms;');
  });
});
