import { once } from 'node:events';
import type { SiteUrl } from '@cert-it/hono';
import {
  ClientIpResolver,
  ResponseCompressor,
  ResponseRevalidator,
} from '@cert-it/hono';
import { LocaleCookieName } from '@cert-it/shared';
import { serve, type ServerType } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { AdminPanelService } from '../admin/AdminPanelService';
import type { BrandingService } from '../branding/BrandingService';
import { CertificateFileRoutes } from '../certificate/file/CertificateFileRoutes';
import { LookupPageRoutes } from '../certificate/lookup/LookupPageRoutes';
import { CertificatePageRoutes } from '../certificate/page/CertificatePageRoutes';
import type { Config } from '../config/schema/ConfigSchema';
import type { CredentialRoutes } from '../credential/CredentialRoutes';
import type { DatabaseService } from '../database/DatabaseService';
import { StartupError } from '../error/StartupError';
import { LocaleResolver } from '../i18n/LocaleResolver';
import { MessageCatalog } from '../i18n/MessageCatalog';
import { PublicAssetsService } from '../page/PublicAssetsService';
import type { LinkPreviewService } from '../page/preview/LinkPreviewService';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { ApiService } from './api/ApiService';
import type { HttpEnv } from './HttpEnv';
import { ConsoleLogger } from '../log/ConsoleLogger';
import type { Logger } from '../log/Logger';

type HttpServiceOptions = {
  port: number;
  siteUrl: SiteUrl;
  clientIps: ClientIpResolver;
  database: DatabaseService;
  locales: LocaleResolver;
  messages: MessageCatalog;
  adminPanel: AdminPanelService;
  certificateFiles: CertificateFileRoutes;
  certificatePages: CertificatePageRoutes;
  lookupPages: LookupPageRoutes;
  publicAssets: PublicAssetsService;
  branding: BrandingService;
  linkPreviews: LinkPreviewService;
  credentials: CredentialRoutes;
  api: ApiService;
  compressor: ResponseCompressor;
  revalidator: ResponseRevalidator;
  logger: Logger;
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

  // a code in a path is enough to open its certificate, so logs leave it out
  protected static readonly CertificateCodeSegment = /\/c\/[^/]+/;

  /** Query parameter the language switcher links set. */
  protected static readonly LocaleParam = 'lang';

  protected static readonly LocaleCookieMaxAgeSeconds = 31_536_000;

  protected readonly port: number;

  protected readonly siteUrl: SiteUrl;

  protected readonly clientIps: ClientIpResolver;

  protected readonly database: DatabaseService;

  protected readonly locales: LocaleResolver;

  protected readonly messages: MessageCatalog;

  protected readonly adminPanel: AdminPanelService;

  protected readonly certificateFiles: CertificateFileRoutes;

  protected readonly certificatePages: CertificatePageRoutes;

  protected readonly lookupPages: LookupPageRoutes;

  protected readonly publicAssets: PublicAssetsService;

  protected readonly branding: BrandingService;

  protected readonly linkPreviews: LinkPreviewService;

  protected readonly credentials: CredentialRoutes;

  protected readonly api: ApiService;

  protected readonly compressor: ResponseCompressor;

  protected readonly revalidator: ResponseRevalidator;

  protected readonly logger: Logger;

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
    this.branding = options.branding;
    this.linkPreviews = options.linkPreviews;
    this.credentials = options.credentials;
    this.api = options.api;
    this.compressor = options.compressor;
    this.revalidator = options.revalidator;
    this.logger = options.logger;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'files' | 'lookup' | 'server' | 'site'>;
    siteUrl: SiteUrl;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    api: ApiService;
    adminPanel: AdminPanelService;
    publicAssets: PublicAssetsService;
    branding: BrandingService;
    linkPreviews: LinkPreviewService;
    credentials: CredentialRoutes;
    injections?: Partial<
      Omit<
        HttpServiceOptions,
        | 'database'
        | 'api'
        | 'adminPanel'
        | 'publicAssets'
        | 'branding'
        | 'linkPreviews'
        | 'credentials'
      >
    >;
  }): HttpService {
    const {
      config,
      siteUrl,
      database,
      dataDirectory,
      api,
      adminPanel,
      publicAssets,
      branding,
      linkPreviews,
      credentials,
      injections,
    } = options;
    const pages = {
      config,
      siteUrl,
      database,
      assets: publicAssets,
      branding,
      previews: linkPreviews,
    };

    return new HttpService({
      port: injections?.port ?? config.server.port,
      siteUrl,
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
      messages: injections?.messages ?? new MessageCatalog(),
      adminPanel,
      certificateFiles:
        injections?.certificateFiles
        ?? CertificateFileRoutes.create({
          config,
          siteUrl,
          database,
          dataDirectory,
          injections: { logger: injections?.logger },
        }),
      certificatePages:
        injections?.certificatePages ?? CertificatePageRoutes.create(pages),
      lookupPages: injections?.lookupPages ?? LookupPageRoutes.create(pages),
      publicAssets,
      branding,
      linkPreviews,
      credentials,
      api,
      compressor: injections?.compressor ?? ResponseCompressor.create(),
      revalidator: injections?.revalidator ?? ResponseRevalidator.create(),
      logger: injections?.logger ?? ConsoleLogger.Instance,
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
    this.logger.info(
      `Listening on port ${this.port} for ${this.siteUrl.url('/')}`,
    );
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
    app.route('/', this.branding.getApp());
    app.route('/', this.linkPreviews.getApp());
    app.route('/', this.certificateFiles.getApp());
    app.route('/', this.credentials.getApp());
    app.route('/', this.certificatePages.getApp());
    app.route('/', this.lookupPages.getApp());

    return root;
  }

  // logs the path without the query, which may hold emails or tokens, nor certificate codes
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
      const pathname = new URL(c.req.url).pathname.replace(
        HttpService.CertificateCodeSegment,
        '/c/:code',
      );
      this.logger.info(
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
