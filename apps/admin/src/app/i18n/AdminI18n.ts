import { LocaleCookieName, LocaleEnum, type Locale } from '@cert-it/shared';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { AdminMessages } from './messages/AdminMessages';
import { EnAdminMessages } from './messages/EnAdminMessages';
import { EsAdminMessages } from './messages/EsAdminMessages';
import { readSiteDefaultLocale } from './readSiteDefaultLocale';

type AdminI18nOptions = {
  instance: i18n;
  /** The page's document, where the language is read from and saved to. */
  document: Document;
  /** The browser's preferred languages, most preferred first. */
  browserLanguages: readonly string[];
};

/** The admin panel's language: its texts, the saved choice, and the dates' locale. */
export class AdminI18n {
  protected static readonly Catalogs: Record<Locale, AdminMessages> = {
    [LocaleEnum.En]: EnAdminMessages,
    [LocaleEnum.Es]: EsAdminMessages,
  };

  protected static readonly Supported: readonly string[] =
    Object.values(LocaleEnum);

  protected static readonly CookieMaxAgeSeconds = 31_536_000;

  protected readonly instance: i18n;

  protected readonly document: Document;

  protected readonly browserLanguages: readonly string[];

  /** Whether the first language is loaded, so later changes are the user's choice. */
  protected started = false;

  constructor(options: AdminI18nOptions) {
    this.instance = options.instance;
    this.document = options.document;
    this.browserLanguages = options.browserLanguages;
  }

  public static create(options?: {
    injections?: Partial<AdminI18nOptions>;
  }): AdminI18n {
    return new AdminI18n({
      instance: options?.injections?.instance ?? createInstance(),
      document: options?.injections?.document ?? document,
      browserLanguages:
        options?.injections?.browserLanguages ?? navigator.languages,
    });
  }

  /** Loads the texts in the saved, browser or site default language, then keeps the page in sync with changes and saves them. */
  public async start(): Promise<void> {
    this.instance.on('languageChanged', (language) =>
      this.applyLocale(language),
    );

    await this.instance.use(initReactI18next).init({
      resources: Object.fromEntries(
        Object.entries(AdminI18n.Catalogs).map(([locale, messages]) => [
          locale,
          { translation: messages },
        ]),
      ),
      lng: this.detectLocale(),
      fallbackLng: LocaleEnum.En,
      supportedLngs: AdminI18n.Supported,
      // react already escapes what it renders
      interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
      returnNull: false,
    });
    this.started = true;
  }

  /** Returns the i18next instance, for `I18nextProvider`. */
  public getInstance(): i18n {
    return this.instance;
  }

  /** Returns the current language. */
  public getLocale(): Locale {
    return this.parse(this.instance.language) ?? LocaleEnum.En;
  }

  /** Returns the given value if it's a supported language, or null. */
  public parse(value: string | null | undefined): Locale | null {
    return value && AdminI18n.Supported.includes(value)
      ? (value as Locale)
      : null;
  }

  // same order as the server: saved choice, browser, site default
  protected detectLocale(): Locale {
    const browser = this.browserLanguages
      .map((tag) => this.parse((tag.split('-')[0] ?? '').toLowerCase()))
      .find((locale) => locale !== null);

    return (
      this.parse(this.readCookie())
      ?? browser
      ?? readSiteDefaultLocale(this.document)
      ?? LocaleEnum.En
    );
  }

  protected applyLocale(language: string): void {
    const locale = this.parse(language);
    if (!locale) return;

    this.document.documentElement.lang = locale;
    // global, for Mantine's date pickers; certificate dates use CourseDateFormatter instead
    dayjs.locale(locale);
    // saving the detected language would override course languages on public pages
    if (this.started) this.writeCookie(locale);
  }

  protected readCookie(): string | null {
    const prefix = `${LocaleCookieName}=`;
    const entry = this.document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    return entry ? entry.slice(prefix.length) : null;
  }

  // under the base path, so the public pages share the choice
  protected writeCookie(locale: Locale): void {
    const { location } = this.document;
    const basePath = location.pathname.replace(/\/admin(\/.*)?$/, '') || '/';
    const secure = location.protocol === 'https:' ? '; Secure' : '';

    this.document.cookie = `${LocaleCookieName}=${locale}; Path=${basePath}; Max-Age=${AdminI18n.CookieMaxAgeSeconds}; SameSite=Lax${secure}`;
  }
}
