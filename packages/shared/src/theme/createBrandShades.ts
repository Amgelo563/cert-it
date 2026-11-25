import { ThemeValues } from './ThemeValues';

// share of white mixed into the shades lighter than the main one, lightest first
const LightMixes = [0.9, 0.8, 0.62, 0.45, 0.3, 0.15];

// share of black mixed into the darker shades
const DarkMixes = [0.15, 0.28, 0.45];

const HexColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Returns the ten brand shades for a main color, lightest first, with the color itself at {@link ThemeValues.brandShadeIndex}.
 * The default brand color returns the built-in shades.
 *
 * @throws {Error} If the color isn't a hex color such as #0050b4.
 */
export function createBrandShades(color: string): string[] {
  if (!HexColor.test(color)) throw new Error(`Not a hex color: ${color}`);

  const rgb = parseHex(color);
  const main = toHex(rgb);
  if (main === ThemeValues.brandShades[ThemeValues.brandShadeIndex]) {
    return [...ThemeValues.brandShades];
  }

  return [
    ...LightMixes.map((share) => toHex(mix(rgb, [255, 255, 255], share))),
    main,
    ...DarkMixes.map((share) => toHex(mix(rgb, [0, 0, 0], share))),
  ];
}

type Rgb = readonly [number, number, number];

function parseHex(color: string): Rgb {
  let digits = color.slice(1);
  if (digits.length === 3) {
    digits = digits.replace(/./g, (digit) => digit + digit);
  }
  return [0, 2, 4].map((start) =>
    Number.parseInt(digits.slice(start, start + 2), 16),
  ) as unknown as Rgb;
}

function mix(color: Rgb, other: Rgb, share: number): Rgb {
  return color.map((value, i) =>
    Math.round(value + (other[i]! - value) * share),
  ) as unknown as Rgb;
}

function toHex(color: Rgb): string {
  return `#${color.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
