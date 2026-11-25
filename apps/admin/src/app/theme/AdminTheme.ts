import { type AdminBranding, ThemeValues } from '@cert-it/shared';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  createTheme,
  type CSSVariablesResolver,
  Input,
  type MantineColorsTuple,
  Menu,
  Modal,
  Paper,
  Popover,
  rem,
  Tooltip,
} from '@mantine/core';

const tuple = (shades: readonly string[]) =>
  [...shades] as unknown as MantineColorsTuple;

/** Returns the Mantine theme of the admin panel: soft, rounded and borderless, from the values shared with the public pages and the site's branding. */
export const createAdminTheme = (branding: AdminBranding) =>
  createTheme({
    primaryColor: 'brand',
    primaryShade: {
      light: ThemeValues.brandShadeIndex,
      dark: ThemeValues.brandShadeIndexDark,
    },
    colors: {
      brand: tuple(branding.brandShades),
      gray: tuple(ThemeValues.neutralShades),
      dark: tuple(ThemeValues.darkShades),
    },
    white: '#ffffff',
    black: ThemeValues.neutralShades[9],
    defaultRadius: 'md',
    radius: {
      xs: rem(6),
      sm: rem(8),
      md: rem(ThemeValues.radiusPx),
      lg: rem(14),
      xl: rem(20),
    },
    shadows: {
      xs: ThemeValues.shadows.small,
      sm: ThemeValues.shadows.small,
      md: ThemeValues.shadows.medium,
      lg: ThemeValues.shadows.large,
      xl: ThemeValues.shadows.large,
    },
    fontFamily: branding.fontFamily,
    fontFamilyMonospace: ThemeValues.monospaceFontFamily,
    headings: {
      fontFamily: branding.fontFamily,
      // hierarchy comes from size, not weight
      fontWeight: '600',
    },
    spacing: { xs: rem(8), sm: rem(12), md: rem(16), lg: rem(24), xl: rem(32) },
    cursorType: 'pointer',
    focusRing: 'auto',
    components: {
      // icon buttons are quiet until hovered, like the rest of the chrome
      ActionIcon: ActionIcon.extend({
        defaultProps: { variant: 'subtle', color: 'gray', radius: 'md' },
      }),
      Badge: Badge.extend({
        defaultProps: { variant: 'light', radius: 'sm' },
        styles: {
          // sentence case, not Mantine's uppercase tracked labels
          root: { textTransform: 'none', letterSpacing: 0, fontWeight: 500 },
          // a hidden overflow lets tables squeeze badges down to an ellipsis
          label: { overflow: 'visible' },
        },
      }),
      Button: Button.extend({ defaultProps: { radius: 'md' } }),
      Card: Card.extend({
        defaultProps: { radius: 'lg', padding: 'lg', shadow: 'sm' },
      }),
      // filled inputs, no borders
      Input: Input.extend({ defaultProps: { variant: 'filled' } }),
      Menu: Menu.extend({ defaultProps: { radius: 'lg', shadow: 'lg' } }),
      Modal: Modal.extend({
        defaultProps: { radius: 'lg', shadow: 'lg', centered: true },
      }),
      Paper: Paper.extend({ defaultProps: { radius: 'lg' } }),
      Popover: Popover.extend({ defaultProps: { radius: 'lg', shadow: 'lg' } }),
      Tooltip: Tooltip.extend({
        defaultProps: { radius: 'sm', openDelay: 300 },
      }),
    },
  });

// shade 4 keeps brand text readable on dark, but white on it is only 4.1:1, so fills go one darker
const DarkFillShade = ThemeValues.brandShadeIndexDark + 1;

/** Dark mode colors that need more contrast than Mantine's defaults. */
export const AdminCssVariables: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {
    '--mantine-color-brand-filled': `var(--mantine-color-brand-${DarkFillShade})`,
    '--mantine-color-brand-filled-hover': `var(--mantine-color-brand-${DarkFillShade + 1})`,
    // red-8 is under 4:1 on the dark surfaces
    '--mantine-color-error': 'var(--mantine-color-red-6)',
  },
});
