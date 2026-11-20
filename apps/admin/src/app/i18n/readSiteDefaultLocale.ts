import { type Locale, LocaleEnum } from '@cert-it/shared';

// filled in by the server, from site.default_locale
const DefaultLocaleMeta = 'cert-it-default-locale';

/** Returns the site's default locale from the page's meta tag, or null if it's missing or unknown. */
export function readSiteDefaultLocale(document: Document): Locale | null {
  const value = document
    .querySelector<HTMLMetaElement>(`meta[name="${DefaultLocaleMeta}"]`)
    ?.getAttribute('content');

  return Object.values(LocaleEnum).find((locale) => locale === value) ?? null;
}
