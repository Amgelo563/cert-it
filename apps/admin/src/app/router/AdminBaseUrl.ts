type AdminBaseUrlOptions = {
  /** The document's base URL, from the `<base>` tag the server injects. */
  baseUri: string;
};

/** Where the admin panel is served, such as `https://example.org/certs/admin/`. */
export class AdminBaseUrl {
  protected readonly url: URL;

  constructor(options: AdminBaseUrlOptions) {
    this.url = new URL(options.baseUri);
  }

  public static create(options?: {
    injections?: Partial<AdminBaseUrlOptions>;
  }): AdminBaseUrl {
    return new AdminBaseUrl({
      baseUri: options?.injections?.baseUri ?? document.baseURI,
    });
  }

  /** Returns the path the router runs under, without a trailing slash, such as `/certs/admin`. */
  public getRouterBasename(): string {
    return this.url.pathname.replace(/\/+$/, '') || '/';
  }
}
