import { type AdminBranding, ThemeValues } from '@cert-it/shared';

// filled in by the server, from the config's branding section
const BrandingMeta = 'cert-it-branding';

const BrandShadeCount = 10;

/** The built-in branding, for the dev server's page, which has no meta tag. */
export const DefaultBranding: AdminBranding = {
  name: 'cert-it',
  brandShades: ThemeValues.brandShades,
  logo: null,
  logoDark: null,
  fontFamily: ThemeValues.fontFamily,
};

/** Returns the site's branding from the page's meta tag, or the built-in one if it's missing or malformed. */
export function readSiteBranding(document: Document): AdminBranding {
  const content = document
    .querySelector<HTMLMetaElement>(`meta[name="${BrandingMeta}"]`)
    ?.getAttribute('content');
  if (!content) return DefaultBranding;

  try {
    const value = JSON.parse(content) as Partial<AdminBranding>;
    return {
      name: typeof value.name === 'string' ? value.name : DefaultBranding.name,
      brandShades:
        Array.isArray(value.brandShades)
        && value.brandShades.length === BrandShadeCount
          ? value.brandShades
          : DefaultBranding.brandShades,
      logo: typeof value.logo === 'string' ? value.logo : null,
      logoDark: typeof value.logoDark === 'string' ? value.logoDark : null,
      fontFamily:
        typeof value.fontFamily === 'string'
          ? value.fontFamily
          : DefaultBranding.fontFamily,
    };
  } catch {
    return DefaultBranding;
  }
}
