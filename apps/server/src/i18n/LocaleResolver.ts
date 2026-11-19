import { type Locale, LocaleEnum } from '@cert-it/shared';

type LocaleResolverOptions = {
  /** Language for visitors without a preference, as in site.default_locale. */
  defaultLocale: Locale;
};

type LocaleSources = {
  /** Language picked in the switcher, from the query. */
  query?: string | undefined;
  /** Language picked earlier, from the cookie. */
  cookie?: string | undefined;
  /** Language of the course the page belongs to, if any. */
  courseLocale?: Locale | undefined;
  /** The browser's Accept-Language header. */
  acceptLanguage?: string | undefined;
};

/** An object that picks the language a page is shown in. */
export class LocaleResolver {
  protected static readonly Supported: readonly string[] =
    Object.values(LocaleEnum);

  protected readonly defaultLocale: Locale;

  constructor(options: LocaleResolverOptions) {
    this.defaultLocale = options.defaultLocale;
  }

  /** Returns the first supported language of the query, cookie, course, browser and site default, in that order. */
  public resolve(sources: LocaleSources): Locale {
    return (
      this.parse(sources.query)
      ?? this.parse(sources.cookie)
      ?? sources.courseLocale
      ?? this.fromAcceptLanguage(sources.acceptLanguage)
      ?? this.defaultLocale
    );
  }

  /** Returns the given value if it's a supported language, or null. */
  public parse(value: string | undefined): Locale | null {
    return value && LocaleResolver.Supported.includes(value)
      ? (value as Locale)
      : null;
  }

  // ignores regions (es-PE => es) and keeps the header's order among equal weights
  protected fromAcceptLanguage(header: string | undefined): Locale | null {
    if (!header) return null;

    const ranges = header
      .split(',')
      .map((part) => {
        const [tag = '', ...params] = part.split(';').map((p) => p.trim());
        const weight = params.find((param) => param.startsWith('q='));

        return {
          language: (tag.split('-')[0] ?? '').toLowerCase(),
          quality: weight ? Number(weight.slice(2)) : 1,
        };
      })
      .filter(({ quality }) => quality > 0)
      .sort((a, b) => b.quality - a.quality);

    for (const { language } of ranges) {
      const locale = this.parse(language);
      if (locale) return locale;
    }

    return null;
  }
}
