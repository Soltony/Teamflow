import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import { AA_LARGE, AA_TEXT, contrastRatio, hslToRgb, luminance, parseHsl } from './contrast';

/**
 * Reads the real stylesheet rather than a copy of the values.
 *
 * A test holding its own copy of the palette would keep passing after somebody
 * changed globals.css, which is exactly the regression worth catching.
 */
function themeTokens(): Record<string, string> {
  const css = readFileSync('src/app/globals.css', 'utf8');
  // The light theme lives in the first :root block.
  const start = css.indexOf(':root {');
  const end = css.indexOf('}', start);
  const block = css.slice(start, end);

  const tokens: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^\s*--([a-z-]+):\s*([^;]+);/);
    if (match) tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const T = themeTokens();
const has = (name: string) => {
  const v = T[name];
  if (!v) throw new Error(`Theme token --${name} is missing from globals.css`);
  return v;
};

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    expect(contrastRatio('0 0% 0%', '0 0% 100%')).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('45 90% 55%', '45 90% 55%')).toBeCloseTo(1, 5);
  });

  it('does not care which colour is given first', () => {
    const a = contrastRatio('26 30% 25%', '47 58% 85%');
    const b = contrastRatio('47 58% 85%', '26 30% 25%');
    expect(a).toBeCloseTo(b, 10);
  });

  it('rejects something that is not an HSL triple', () => {
    expect(() => parseHsl('#ffffff')).toThrow();
    expect(() => parseHsl('47 58%')).toThrow();
  });

  it('handles a fully desaturated colour', () => {
    expect(hslToRgb([0, 0, 100])).toEqual([255, 255, 255]);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 5);
  });
});

/**
 * The palette itself. Each of these was measured as failing before the theme
 * was corrected; the ratio in the comment is what it used to be.
 */
describe('the theme meets WCAG AA', () => {
  const textPairs: Array<[string, string, string]> = [
    ['body text on the page', 'foreground', 'background'],
    ['body text on a card', 'foreground', 'card'],
    ['secondary text on the page', 'muted-foreground', 'background'],      // was 3.68:1
    ['secondary text on a card', 'muted-foreground', 'card'],              // was 4.34:1
    ['secondary text on a muted surface', 'muted-foreground', 'muted'],    // was 4.03:1
    ['a primary button label', 'primary-foreground', 'primary'],
    ['a delete button label', 'destructive-foreground', 'destructive'],    // was 3.60:1
  ];

  for (const [name, fg, bg] of textPairs) {
    it(`${name} is readable`, () => {
      const ratio = contrastRatio(has(fg), has(bg));
      expect(ratio, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  const controlPairs: Array<[string, string, string]> = [
    ['a text field boundary on the page', 'input', 'background'],          // was 1.01:1
    ['a text field boundary on a card', 'input', 'card'],
    ['the keyboard focus ring on the page', 'ring', 'background'],         // was 1.35:1
    ['the keyboard focus ring on a card', 'ring', 'card'],
    ['a switch in its off state', 'switch-off', 'card'],
  ];

  for (const [name, fg, bg] of controlPairs) {
    it(`${name} is perceivable`, () => {
      const ratio = contrastRatio(has(fg), has(bg));
      expect(ratio, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_LARGE);
    });
  }

  it('keeps a switch distinguishable from its own on state', () => {
    // Colour alone must not be the difference between on and off.
    const ratio = contrastRatio(has('switch-off'), has('primary'));
    expect(ratio, `off vs on is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('gives decorative borders enough presence to be seen', () => {
    // Not a WCAG rule — card edges and table rules are decorative — but the
    // previous value sat at 1.01:1, which is to say there were no visible
    // borders anywhere in the application.
    const ratio = contrastRatio(has('border'), has('background'));
    expect(ratio, `--border on --background is ${ratio.toFixed(2)}:1`).toBeGreaterThan(1.3);
  });

  it('keeps the sidebar readable', () => {
    expect(contrastRatio(has('sidebar-foreground'), has('sidebar-background')))
      .toBeGreaterThanOrEqual(AA_TEXT);
  });
});
