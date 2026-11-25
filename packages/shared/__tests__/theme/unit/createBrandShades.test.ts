import { describe, expect, test } from 'vite-plus/test';
import { createBrandShades } from '../../../src/theme/createBrandShades';
import { ThemeValues } from '../../../src/theme/ThemeValues';

const luminance = (hex: string) =>
  [1, 3, 5]
    .map((start) => Number.parseInt(hex.slice(start, start + 2), 16))
    .reduce((sum, value) => sum + value, 0);

describe('createBrandShades', () => {
  test('GIVEN the default brand color in any case WHEN creating shades THEN returns the built-in ones', () => {
    expect(createBrandShades('#0050B4')).toEqual(ThemeValues.brandShades);
  });

  test('GIVEN another color WHEN creating shades THEN puts it at the main index, lowercased', () => {
    const shades = createBrandShades('#C2185B');

    expect(shades).toHaveLength(10);
    expect(shades[ThemeValues.brandShadeIndex]).toBe('#c2185b');
  });

  test('GIVEN a color WHEN creating shades THEN goes from lightest to darkest', () => {
    const levels = createBrandShades('#2e7d32').map(luminance);

    expect(levels).toEqual([...levels].sort((a, b) => b - a));
  });

  test('GIVEN a short hex color WHEN creating shades THEN expands it', () => {
    expect(createBrandShades('#f60')[ThemeValues.brandShadeIndex]).toBe(
      '#ff6600',
    );
  });

  test('GIVEN a value that is not a hex color WHEN creating shades THEN throws', () => {
    expect(() => createBrandShades('red')).toThrow('Not a hex color: red');
  });
});
