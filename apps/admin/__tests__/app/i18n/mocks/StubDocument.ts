type StubDocumentOptions = {
  cookie?: string;
  pathname?: string;
  protocol?: string;
  defaultLocale?: string;
};

/** A minimal document whose cookie keeps only the last written value. */
export class StubDocument {
  public cookie: string;

  public readonly documentElement = { lang: '' };

  public readonly location: { pathname: string; protocol: string };

  protected readonly defaultLocale: string | undefined;

  constructor(options: StubDocumentOptions = {}) {
    this.cookie = options.cookie ?? '';
    this.location = {
      pathname: options.pathname ?? '/admin/',
      protocol: options.protocol ?? 'https:',
    };
    this.defaultLocale = options.defaultLocale;
  }

  /** Returns the default locale meta tag, the only element looked up. */
  public querySelector(_selector: string): { getAttribute(): string } | null {
    const { defaultLocale } = this;
    return defaultLocale ? { getAttribute: () => defaultLocale } : null;
  }

  /** Returns this stub typed as a document, for injection. */
  public asDocument(): Document {
    return this as unknown as Document;
  }
}
