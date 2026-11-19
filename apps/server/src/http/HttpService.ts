import { once } from 'node:events';
import { serve, type ServerType } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { StartupError } from '../error/StartupError';
import { ClientIpResolver } from './clientIp/ClientIpResolver';
import type { HttpEnv } from './HttpEnv';
import { SiteUrl } from './url/SiteUrl';

type HttpServiceOptions = {
  port: number;
  siteUrl: SiteUrl;
  clientIps: ClientIpResolver;
  database: DatabaseService;
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

  // no includeSubDomains, the app may run under a path of a shared domain
  protected static readonly HstsMaxAgeSeconds = 31_536_000;

  protected static readonly HealthPath = '/healthz';

  protected readonly port: number;

  protected readonly siteUrl: SiteUrl;

  protected readonly clientIps: ClientIpResolver;

  protected readonly database: DatabaseService;

  protected readonly log: (line: string) => void;

  protected readonly app: Hono<HttpEnv>;

  protected server: ServerType | null = null;

  constructor(options: HttpServiceOptions) {
    this.port = options.port;
    this.siteUrl = options.siteUrl;
    this.clientIps = options.clientIps;
    this.database = options.database;
    this.log = options.log ?? console.log;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
  }): HttpService {
    const { config, database } = options;

    return new HttpService({
      port: config.server.port,
      siteUrl: new SiteUrl({ baseUrl: config.site.baseUrl }),
      clientIps: new ClientIpResolver({
        trustedProxies: config.server.trustedProxies,
      }),
      database,
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
    // not strict, so the base path matches with and without a trailing slash
    const root = new Hono<HttpEnv>({ strict: false });
    const app = root.basePath(this.siteUrl.getBasePath());

    root.use(this.resolveClientIp(), this.logRequests(), this.secureHeaders());

    // at the root too, so health checks don't depend on the base path
    root.get(HttpService.HealthPath, (c) => this.healthz(c));
    if (this.siteUrl.getBasePath() !== '/') {
      app.get(HttpService.HealthPath, (c) => this.healthz(c));
    }

    app.get('/', (c) => c.text('Hello Hono!'));

    return root;
  }

  protected resolveClientIp(): MiddlewareHandler<HttpEnv> {
    return async (c, next) => {
      const address = getConnInfo(c).remote.address ?? '';
      c.set('clientIp', this.clientIps.resolve(address, c.req.raw.headers));
      await next();
    };
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

  protected secureHeaders(): MiddlewareHandler<HttpEnv> {
    const headers = secureHeaders({
      xFrameOptions: 'SAMEORIGIN',
      strictTransportSecurity:
        this.siteUrl.isSecure() && `max-age=${HttpService.HstsMaxAgeSeconds}`,
    });
    const adminPath = this.siteUrl.path('/admin');

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
