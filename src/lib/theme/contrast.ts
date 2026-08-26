/**
 * Colour contrast, so the palette can be checked rather than eyeballed.
 *
 * The theme is written in HSL triples inside globals.css. Six of its pairs
 * failed WCAG AA when they were first measured — secondary text at 3.7:1, the
 * delete button at 3.6:1, and the keyboard focus ring at 1.35:1, which meant
 * anyone navigating without a mouse could not see where they were.
 *
 * Pure arithmetic, no DOM, so the rules can be asserted in a unit test.
 */

export type Hsl = readonly [h: number, s: number, l: number];

/** Parses the `"H S% L%"` form used by the CSS custom properties. */
export function parseHsl(value: string): Hsl {
  const parts = value.trim().split(/\s+/).map((p) => parseFloat(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Not an HSL triple: "${value}"`);
  }
  return [parts[0], parts[1], parts[2]] as const;
}

export function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const hn = h / 360;
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) return [ln * 255, ln * 255, ln * 255];

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(hn + 1 / 3) * 255, channel(hn) * 255, channel(hn - 1 / 3) * 255];
}

/** Relative luminance, per WCAG 2.1. */
export function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, from 1:1 to 21:1. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(hslToRgb(parseHsl(a)));
  const lb = luminance(hslToRgb(parseHsl(b)));
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA thresholds. */
export const AA_TEXT = 4.5;
/** Large text, and the boundary of any non-text control. */
export const AA_LARGE = 3;
