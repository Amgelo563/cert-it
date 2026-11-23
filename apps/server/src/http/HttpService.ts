import { once } from 'node:events';
import {
  ClientIpResolver,
  ResponseCompressor,
  ResponseRevalidator,
  SiteUrl,
} from '@cert-it/hono';
import { LocaleCookieName } from '@cert-it/shared';
import { serve, type ServerType } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { AdminPanelService } from '../admin/AdminPanelService';
import { CertificateFileService } from '../certificate/file/CertificateFileService';
import { LookupPageService } from '../certificate/lookup/LookupPageService';
import { CertificatePageService } from '../certificate/page/CertificatePageService';
import type { Config } from '../config/schema/ConfigSchema';
import type { CredentialService } from '../credential/CredentialService';
import type { DatabaseService } from '../database/DatabaseService';
import { StartupError } from '../error/StartupError';
import { LocaleResolver } from '../i18n/LocaleResolver';
import { MessagesService } from '../i18n/MessagesService';
import { PublicAssetsService } from '../page/PublicAssetsService';
import type { LinkPreviewService } from '../page/preview/LinkPreviewService';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { ApiService } from './api/ApiService';
import type { HttpEnv } from './HttpEnv';

type HttpServiceOptions = {
  port: number;
  siteUrl: SiteUrl;
  clientIps: ClientIpResolver;
  database: DatabaseService;
  locales: LocaleResolver;
  messages: MessagesService;
  adminPanel: AdminPanelService;
  certificateFiles: CertificateFileService;
  certificatePages: CertificatePageService;
  lookupPages: LookupPageService;
  publicAssets: PublicAssetsService;
  linkPreviews: LinkPreviewService;
  credentials: CredentialService;
  api: ApiService;
  compressor: ResponseCompressor;
  revalidator: ResponseRevalidator;
  /** @default console.log */
  log?: (line: string) => void;
};

/** The app's HTTP server, with its middleware and routes. */
export class HttpService {
  public static readonly PublicCsp =
    "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

  // must match the admin location in the nginx config
  public static readonly AdminCsp =
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

  // only on a host of its own: under a path, the site's HSTS would be replaced
  protected static readonly HstsMaxAgeSeconds = 31_536_000;

  protected static readonly HealthPath = '/healthz';

  /** Query parameter the language switcher links set. */
  protected static readonly LocaleParam = 'lang';

  protected static readonly LocaleCookieMaxAgeSeconds = 31_536_000;

  protected readonly port: number;

  protected readonly siteUrl: SiteUrl;

  protected readonly clientIps: ClientIpResolver;

  protected readonly database: DatabaseService;

  protected readonly locales: LocaleResolver;

  protected readonly messages: MessagesService;

  protected readonly adminPanel: AdminPanelService;

  protected readonly certificateFiles: CertificateFileService;

  protected readonly certificatePages: CertificatePageService;

  protected readonly lookupPages: LookupPageService;

  protected readonly publicAssets: PublicAssetsService;

  protected readonly linkPreviews: LinkPreviewService;

  protected readonly credentials: CredentialService;

  protected readonly api: ApiService;

  protected readonly compressor: ResponseCompressor;

  protected readonly revalidator: ResponseRevalidator;

  protected readonly log: (line: string) => void;

  protected readonly app: Hono<HttpEnv>;

  protected server: ServerType | null = null;

  constructor(options: HttpServiceOptions) {
    this.port = options.port;
    this.siteUrl = options.siteUrl;
    this.clientIps = options.clientIps;
    this.database = options.database;
    this.locales = options.locales;
    this.messages = options.messages;
    this.adminPanel = options.adminPanel;
    this.certificateFiles = options.certificateFiles;
    this.certificatePages = options.certificatePages;
    this.lookupPages = options.lookupPages;
    this.publicAssets = options.publicAssets;
    this.linkPreviews = options.linkPreviews;
    this.credentials = options.credentials;
    this.api = options.api;
    this.compressor = options.compressor;
    this.revalidator = options.revalidator;
    this.log = options.log ?? console.log;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    api: ApiService;
    adminPanel: AdminPanelService;
    publicAssets: PublicAssetsService;
    linkPreviews: LinkPreviewService;
    credentials: CredentialService;
    injections?: Partial<HttpServiceOptions>;
  }): HttpService {
    const { config, dataDirectory, injections } = options;
    const database = injections?.database ?? options.database;
    const assets = injections?.publicAssets ?? options.publicAssets;
    const previews = injections?.linkPreviews ?? options.linkPreviews;
    const pages = { config, database, assets, previews };

    return new HttpService({
      port: injections?.port ?? config.server.port,
      siteUrl:
        injections?.siteUrl ?? new SiteUrl({ baseUrl: config.site.baseUrl }),
      clientIps:
        injections?.clientIps
        ?? new ClientIpResolver({
          trustedProxies: config.server.trustedProxies,
          getConnInfo,
        }),
      database,
      locales:
        injections?.locales
        ?? new LocaleResolver({ defaultLocale: config.site.defaultLocale }),
      messages: injections?.messages ?? new MessagesService(),
      adminPanel: injections?.adminPanel ?? options.adminPanel,
      certificateFiles:
        injections?.certificateFiles
        ?? CertificateFileService.create({ config, database, dataDirectory }),
      certificatePages:
        injections?.certificatePages ?? CertificatePageService.create(pages),
      lookupPages: injections?.lookupPages ?? LookupPageService.create(pages),
      publicAssets: assets,
      linkPreviews: previews,
      credentials: injections?.credentials ?? options.credentials,
      api: injections?.api ?? options.api,
      compressor: injections?.compressor ?? new ResponseCompressor(),
      revalidator: injections?.revalidator ?? new ResponseRevalidator(),
      log: injections?.log,
    });
  }

  /**
   * Starts listening on the configured port.
   *
   * @throws {StartupError} If the port can't be used, such as when it's already taken.
   */
  public async start(): Promise<void> {
    const server = serve({ fetch: this.app.fetch, port: this.port });

    try {
      await once(server, 'listening');
    } catch (error) {
      throw new StartupError(`Couldn't listen on port ${this.port}`, {
        cause: error,
      });
    }

    this.server = server;
    this.log(`Listening on port ${this.port} for ${this.siteUrl.url('/')}`);
  }

  /** Stops accepting connections and waits for open requests to finish. */
  public stop(): Promise<void> {
    const { server } = this;
    if (!server) return Promise.resolve();

    this.server = null;
    return new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  /** Returns the Hono app, with every route under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const root = new Hono<HttpEnv>({ strict: false });
    const app = root.basePath(this.siteUrl.getBasePath());

    root.use(
      this.clientIps.middleware(),
      this.logRequests(),
      this.secureHeaders(),
      this.compressor.middleware(),
      this.revalidator.middleware(),
    );
    app.use(this.resolveLocale());

    // at the root too, so health checks don't depend on the base path
    root.get(HttpService.HealthPath, (c) => this.healthz(c));
    if (this.siteUrl.getBasePath() !== '/') {
      app.get(HttpService.HealthPath, (c) => this.healthz(c));
    }

    app.route('/', this.api.getApp());
    app.route(AdminPanelService.Path, this.adminPanel.getApp());
    app.route(PublicAssetsService.Path, this.publicAssets.getApp());
    app.route('/', this.linkPreviews.getApp());
    app.route('/', this.certificateFiles.getApp());
    app.route('/', this.credentials.getApp());
    app.route('/', this.certificatePages.getApp());
    app.route('/', this.lookupPages.getApp());

    return root;
  }

  // logs the path without the query, which may hold emails or tokens
  protected logRequests(): MiddlewareHandler<HttpEnv> {
    const healthPaths = new Set([
      HttpService.HealthPath,
      this.siteUrl.path(HttpService.HealthPath),
    ]);

    return async (c, next) => {
      const startedAt = performance.now();
      await next();
      if (healthPaths.has(c.req.path)) return;

      const ms = Math.round(performance.now() - startedAt);
      const { pathname } = new URL(c.req.url);
      this.log(
        `${c.req.method} ${pathname} ${c.res.status} ${ms}ms ${c.get('clientIp')}`,
      );
    };
  }

  // a ?lang= choice is saved for the whole app, admin panel included
  protected resolveLocale(): MiddlewareHandler<HttpEnv> {
    return async (c, next) => {
      const chosen = this.locales.parse(c.req.query(HttpService.LocaleParam));
      if (chosen) {
        setCookie(c, LocaleCookieName, chosen, {
          path: this.siteUrl.getBasePath(),
          maxAge: HttpService.LocaleCookieMaxAgeSeconds,
          sameSite: 'Lax',
          secure: this.siteUrl.isSecure(),
        });
      }

      const sources = {
        query: chosen ?? undefined,
        cookie: getCookie(c, LocaleCookieName),
        acceptLanguage: c.req.header('accept-language'),
      };
      c.set('locale', this.locales.resolve(sources));
      c.set('localeSources', sources);
      c.set('messages', this.messages);
      await next();
    };
  }

  protected secureHeaders(): MiddlewareHandler<HttpEnv> {
    const headers = secureHeaders({
      xFrameOptions: 'SAMEORIGIN',
      strictTransportSecurity:
        this.siteUrl.isSecure()
        && this.siteUrl.getBasePath() === '/'
        && `max-age=${HttpService.HstsMaxAgeSeconds}`,
    });
    const adminPath = this.siteUrl.path(AdminPanelService.Path);

    return async (c, next) => {
      await headers(c, next);

      const { path } = c.req;
      const isAdmin = path === adminPath || path.startsWith(`${adminPath}/`);
      c.header(
        'Content-Security-Policy',
        isAdmin ? HttpService.AdminCsp : HttpService.PublicCsp,
      );
    };
  }

  protected healthz(c: Context<HttpEnv>): Response {
    c.header('Cache-Control', 'no-store');

    try {
      this.database.ping();
      return c.text('ok');
    } catch {
      return c.text('unavailable', 503);
    }
  }
}
