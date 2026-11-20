import { once } from 'node:events';
import {
  ClientIpResolver,
  type CsrfGuard,
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
import { AuditLogService } from '../audit/AuditLogService';
import { AuthService } from '../auth/AuthService';
import { createCsrfGuard } from '../auth/csrf/createCsrfGuard';
import type { CertificateFileService } from '../certificate/file/CertificateFileService';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { StartupError } from '../error/StartupError';
import { LocaleResolver } from '../i18n/LocaleResolver';
import { MessagesService } from '../i18n/MessagesService';
import { UserService } from '../user/UserService';
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
  auth: AuthService;
  users: UserService;
  auditLog: AuditLogService;
  csrf: CsrfGuard;
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

  protected static readonly ApiPath = '/api';

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

  protected readonly auth: AuthService;

  protected readonly users: UserService;

  protected readonly auditLog: AuditLogService;

  protected readonly csrf: CsrfGuard;

  protected readonly compressor: ResponseCompressor;

  protected readonly revalidator: ResponseRevalidator;

  protected readonly log: (line: string) => void;

  protected readonly api: ReturnType<HttpService['createApi']>;

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
    this.auth = options.auth;
    this.users = options.users;
    this.auditLog = options.auditLog;
    this.csrf = options.csrf;
    this.compressor = options.compressor;
    this.revalidator = options.revalidator;
    this.log = options.log ?? console.log;
    this.api = this.createApi();
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    adminPanel: AdminPanelService;
    certificateFiles: CertificateFileService;
    auth: AuthService;
    users: UserService;
    auditLog: AuditLogService;
  }): HttpService {
    const {
      config,
      database,
      adminPanel,
      certificateFiles,
      auth,
      users,
      auditLog,
    } = options;
    const siteUrl = new SiteUrl({ baseUrl: config.site.baseUrl });

    return new HttpService({
      port: config.server.port,
      siteUrl,
      clientIps: new ClientIpResolver({
        trustedProxies: config.server.trustedProxies,
        getConnInfo,
      }),
      database,
      locales: new LocaleResolver({ defaultLocale: config.site.defaultLocale }),
      messages: new MessagesService(),
      adminPanel,
      certificateFiles,
      auth,
      users,
      auditLog,
      csrf: createCsrfGuard(siteUrl),
      compressor: new ResponseCompressor(),
      revalidator: new ResponseRevalidator(),
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

  /** Returns the API routes, mounted under the base path, typed for the admin panel as CertItApi. */
  public getApi(): HttpService['api'] {
    return this.api;
  }

  // chained, so hono/client can infer the routes' types
  protected createApi() {
    return new Hono<HttpEnv>({ strict: false })
      .route(AuthService.Path, this.auth.getApp())
      .route(UserService.Path, this.users.getApp())
      .route(AuditLogService.Path, this.auditLog.getApp());
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

    app.use(`${HttpService.ApiPath}/*`, this.csrf.middleware(), this.noStore());
    app.route('/', this.api);

    app.get('/', (c) => c.text('Hello Hono!'));
    app.route(AdminPanelService.Path, this.adminPanel.getApp());
    app.route('/', this.certificateFiles.getApp());

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

      c.set(
        'locale',
        this.locales.resolve({
          query: chosen ?? undefined,
          cookie: getCookie(c, LocaleCookieName),
          acceptLanguage: c.req.header('accept-language'),
        }),
      );
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

  // API answers are per user and change with every write
  protected noStore(): MiddlewareHandler<HttpEnv> {
    return async (c, next) => {
      await next();
      c.header('Cache-Control', 'no-store');
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
