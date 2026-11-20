import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { SiteUrl } from '@cert-it/hono';
import type { Locale } from '@cert-it/shared';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import type { Config } from '../config/schema/ConfigSchema';
import { StartupError } from '../error/StartupError';
import type { HttpEnv } from '../http/HttpEnv';

type AdminPanelServiceOptions = {
  /** Directory of the admin panel's build (`apps/admin/dist`), absolute or relative to the working directory. */
  directory: string;
  siteUrl: SiteUrl;
  /** Language of the panel when neither the user nor the browser chose one. */
  defaultLocale: Locale;
};

/** Serves the admin panel's build under `{base_path}/admin/`, with the base path injected into its page. */
export class AdminPanelService {
  /** Path the panel is served under, relative to the base path. */
  public static readonly Path = '/admin';

  // relative to the working directory, like config/ and the data directory: apps/server in the repo
  protected static readonly DefaultDirectory = '../admin/dist';

  protected static readonly IndexFileName = 'index.html';

  // read by AdminI18n
  protected static readonly DefaultLocaleMeta = 'cert-it-default-locale';

  // hashed by Vite, so their content never changes
  protected static readonly ImmutableCacheControl =
    'public, max-age=31536000, immutable';

  protected static readonly RevalidateCacheControl = 'no-cache';

  protected readonly directory: string;

  protected readonly siteUrl: SiteUrl;

  protected readonly defaultLocale: Locale;

  protected readonly app: Hono<HttpEnv>;

  /** The panel's page, read at start. */
  protected indexHtml: string | null = null;

  constructor(options: AdminPanelServiceOptions) {
    this.directory = resolve(options.directory);
    this.siteUrl = options.siteUrl;
    this.defaultLocale = options.defaultLocale;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    injections?: Partial<AdminPanelServiceOptions>;
  }): AdminPanelService {
    const { config, injections } = options;

    return new AdminPanelService({
      directory: injections?.directory ?? AdminPanelService.DefaultDirectory,
      siteUrl:
        injections?.siteUrl ?? new SiteUrl({ baseUrl: config.site.baseUrl }),
      defaultLocale: injections?.defaultLocale ?? config.site.defaultLocale,
    });
  }

  /**
   * Reads the panel's page from its build.
   *
   * @throws {StartupError} If the build is missing, such as when `apps/admin` wasn't built.
   */
  public async start(): Promise<void> {
    const path = join(this.directory, AdminPanelService.IndexFileName);

    try {
      this.indexHtml = await readFile(path, 'utf8');
    } catch (error) {
      throw new StartupError(
        `Couldn't read the admin panel at ${path}, build apps/admin first`,
        { cause: error },
      );
    }
  }

  /** Returns the routes of the panel, to mount at {@link AdminPanelService.Path} under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });

    app.get('*', this.serveFiles(), (c) => {
      if (!this.isFile(c)) return this.renderPage(c);

      c.header('Cache-Control', 'no-store');
      return c.notFound();
    });

    return app;
  }

  // a path whose last segment has an extension is a file; anything else is a page of the SPA
  protected isFile(c: Context<HttpEnv>): boolean {
    const file = this.filePath(c);
    const name = file.slice(file.lastIndexOf('/') + 1);
    return name.includes('.') && name !== AdminPanelService.IndexFileName;
  }

  protected filePath(c: Context<HttpEnv>): string {
    return c.req.path.slice(this.siteUrl.path(AdminPanelService.Path).length);
  }

  // missing files fall through to a 404, never to the page, so a stale chunk fails clearly
  protected serveFiles(): MiddlewareHandler<HttpEnv> {
    const files = serveStatic<HttpEnv>({
      root: this.directory,
      precompressed: true,
      rewriteRequestPath: (path) =>
        path.slice(this.siteUrl.path(AdminPanelService.Path).length),
    });

    return async (c, next) => {
      if (!this.isFile(c)) return next();

      // set before serving: serveStatic builds the response before its onFound runs
      c.header(
        'Cache-Control',
        this.filePath(c).startsWith('/assets/')
          ? AdminPanelService.ImmutableCacheControl
          : AdminPanelService.RevalidateCacheControl,
      );
      return files(c, next);
    };
  }

  protected renderPage(c: Context<HttpEnv>): Response {
    const { indexHtml } = this;
    if (indexHtml === null) {
      return c.text('The admin panel is not started', 503);
    }

    c.header('Cache-Control', AdminPanelService.RevalidateCacheControl);
    return c.html(this.injectIntoPage(indexHtml, c.get('locale')));
  }

  // <base> makes the build's relative asset paths resolve from any page, such as {base}/admin/courses/5
  protected injectIntoPage(html: string, locale: Locale): string {
    const base = this.escape(this.siteUrl.path(`${AdminPanelService.Path}/`));
    const defaultLocale = this.escape(this.defaultLocale);
    const head = [
      `<base href="${base}">`,
      `<meta name="${AdminPanelService.DefaultLocaleMeta}" content="${defaultLocale}">`,
    ].join('');

    return html
      .replace(/<html\b[^>]*>/i, `<html lang="${this.escape(locale)}">`)
      .replace(/<head>/i, `<head>${head}`);
  }

  protected escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}
