type SiteUrlOptions = {
  /** Public address of the app, as in site.base_url. */
  baseUrl: string;
};

/** The app's public address and everything derived from it. */
export class SiteUrl {
  protected readonly origin: string;

  /** Path the app is served under, without a trailing slash, or empty at the root. */
  protected readonly basePath: string;

  protected readonly secure: boolean;

  constructor(options: SiteUrlOptions) {
    const url = new URL(options.baseUrl);

    this.origin = url.origin;
    this.basePath = url.pathname.replace(/\/+$/, '');
    this.secure = url.protocol === 'https:';
  }

  /** Returns the given app path prefixed with the base path. */
  public path(path: string): string {
    return `${this.basePath}${path}`;
  }

  /** Returns the absolute public URL of the given app path. */
  public url(path: string): string {
    return `${this.origin}${this.path(path)}`;
  }

  /** Returns the base path, or a slash at the root. */
  public getBasePath(): string {
    return this.basePath || '/';
  }

  /** Returns the origin, for the CSRF origin check. */
  public getOrigin(): string {
    return this.origin;
  }

  /** Returns whether the app is served over HTTPS. */
  public isSecure(): boolean {
    return this.secure;
  }
}
