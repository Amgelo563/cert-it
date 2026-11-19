/** Colors, radius, shadows and fonts shared by the admin panel's theme and the public pages' CSS, so both look alike. */
export const ThemeValues = {
  /** Shades of the brand color, lightest first, as Mantine expects them. */
  brandShades: [
    '#e6f0fb',
    '#cddff5',
    '#9dbdeb',
    '#6a9ae1',
    '#3f7cd8',
    '#2468d1',
    '#0050b4',
    '#00449a',
    '#003a84',
    '#002e6b',
  ],
  /** Index in {@link ThemeValues.brandShades} of the main brand color, the default link preview color too. */
  brandShadeIndex: 6,
  /** Index of the brand shade used on dark backgrounds, lighter so it keeps its contrast. */
  brandShadeIndexDark: 4,
  /** Neutral grays (zinc), lightest first: page backgrounds, borders, muted text. */
  neutralShades: [
    '#fafafa',
    '#f4f4f5',
    '#e4e4e7',
    '#d4d4d8',
    '#a1a1aa',
    '#71717a',
    '#52525b',
    '#3f3f46',
    '#27272a',
    '#18181b',
  ],
  /** Dark mode surfaces and text, as Mantine's `dark` colors: text first, page background last. */
  darkShades: [
    '#ececee',
    '#a1a1aa',
    '#8b8b94',
    '#71717a',
    '#3f3f46',
    '#2f2f35',
    '#27272a',
    '#18181b',
    '#0e0e10',
    '#000000',
  ],
  /** Default radius of controls and cards; small elements use less, large surfaces a bit more. */
  radiusPx: 12,
  /** Soft layered shadows, from small (cards) to large (menus, modals). */
  shadows: {
    small:
      '0 0 5px 0 rgb(0 0 0 / 0.02), 0 2px 10px 0 rgb(0 0 0 / 0.06), 0 0 1px 0 rgb(0 0 0 / 0.3)',
    medium:
      '0 0 15px 0 rgb(0 0 0 / 0.03), 0 2px 30px 0 rgb(0 0 0 / 0.08), 0 0 1px 0 rgb(0 0 0 / 0.3)',
    large:
      '0 0 30px 0 rgb(0 0 0 / 0.04), 0 30px 60px 0 rgb(0 0 0 / 0.12), 0 0 1px 0 rgb(0 0 0 / 0.3)',
  },
  // Inter is self-hosted by each app (the CSPs only allow fonts served by the app); system fonts otherwise
  fontFamily:
    "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  monospaceFontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;
