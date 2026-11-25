import {
  ClientIpResolver,
  ResponseCompressor,
  ResponseRevalidator,
  SiteUrl,
} from '@cert-it/hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { LocaleEnum, type Role, RoleEnum } from '@cert-it/shared';
import { AdminPanelService } from '../../../src/admin/AdminPanelService';
import { PasswordHasher } from '../../../src/auth/password/PasswordHasher';
import { AccelFileServer } from '../../../src/certificate/file/AccelFileServer';
import { CertificateFileRoutes } from '../../../src/certificate/file/CertificateFileRoutes';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { ApiService } from '../../../src/http/api/ApiService';
import { HttpService } from '../../../src/http/HttpService';
import { LocaleResolver } from '../../../src/i18n/LocaleResolver';
import { MessageCatalog } from '../../../src/i18n/MessageCatalog';
import type { User } from '../../../src/user/User';
import { normalizeEmail } from '../../../src/util/email/NormalizedEmail';
import { createAuthOptions } from '../../auth/mocks/createAuthOptions';
import {
  createPublicPageOptions,
  type LinkPreviewSettings,
} from '../../page/mocks/createPublicPageOptions';
import { sessionCookie } from '../../auth/mocks/createAuthApp';
import { MockLogger } from '../../log/mocks/MockLogger';
import { createTestBranding } from '../../branding/mocks/createTestBranding';

export type ApiRequestInit = {
  /** Sent as JSON, except text and bytes, which are sent as they are. */
  body?: unknown;
  cookie?: string;
  ip?: string;
  origin?: string;
};

/** Origin of the harness's base_url. */
export const ApiHarnessOrigin = 'https://example.org';

/** Password of every user the harness creates. */
export const ApiHarnessPassword = 'correct horse battery';

const passwords = new PasswordHasher();

/** The whole HttpService under the /certs base path, with helpers to call its API as a browser would. */
export function createApiHarness(
  database: DatabaseService,
  options: Parameters<typeof createAuthOptions>[2] & {
    linkPreviews?: LinkPreviewSettings;
    /** Null hides the LinkedIn button. */
    linkedinOrgId?: string | null;
    /** Branding settings, with the built-in look by default. */
    branding?: Parameters<typeof createTestBranding>[1];
  } = {},
) {
  const siteUrl = new SiteUrl({ baseUrl: `${ApiHarnessOrigin}/certs` });
  const api = new ApiService(createAuthOptions(database, siteUrl, options));
  const branding = createTestBranding(siteUrl, options.branding);
  const http = new HttpService({
    port: 0,
    siteUrl,
    clientIps: new ClientIpResolver({
      trustedProxies: ['127.0.0.0/8'],
      getConnInfo,
    }),
    database,
    locales: new LocaleResolver({ defaultLocale: LocaleEnum.En }),
    messages: new MessageCatalog(),
    adminPanel: new AdminPanelService({
      directory: '.',
      siteUrl,
      defaultLocale: LocaleEnum.En,
      branding,
    }),
    certificateFiles: new CertificateFileRoutes({
      database,
      fileServer: new AccelFileServer({ siteUrl }),
      logger: new MockLogger(),
    }),
    ...createPublicPageOptions(
      database,
      siteUrl,
      { dataDirectory: options.dataDirectory, ...options.linkPreviews },
      options.linkedinOrgId,
      branding,
    ),
    api,
    compressor: ResponseCompressor.create(),
    revalidator: ResponseRevalidator.create(),
    logger: new MockLogger(),
  });

  /** Sends a request to a path under /certs/api. */
  const request = (
    method: string,
    path: string,
    init: ApiRequestInit = {},
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      origin: init.origin ?? ApiHarnessOrigin,
      'x-real-ip': init.ip ?? '198.51.100.1',
    };
    if (init.cookie) headers['cookie'] = init.cookie;
    const raw =
      typeof init.body === 'string' || init.body instanceof Uint8Array;
    if (init.body !== undefined && !raw) {
      headers['content-type'] = 'application/json';
    }

    return Promise.resolve(
      http.getApp().request(
        `/certs/api${path}`,
        {
          method,
          headers,
          body:
            raw || init.body === undefined
              ? (init.body as string | Uint8Array<ArrayBuffer> | undefined)
              : JSON.stringify(init.body),
        },
        { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
      ),
    );
  };

  /** Sends a GET to a public path under /certs, such as a certificate's PDF. */
  const requestPublic = (
    path: string,
    headers: Record<string, string> = {},
  ): Promise<Response> =>
    Promise.resolve(
      http
        .getApp()
        .request(
          `/certs${path}`,
          { headers: { 'x-real-ip': '198.51.100.1', ...headers } },
          { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
        ),
    );

  /** Posts a form to a public path under /certs, as a browser would from the app's own page. */
  const postForm = (
    path: string,
    fields: Record<string, string>,
    headers: Record<string, string> = {},
  ): Promise<Response> =>
    Promise.resolve(
      http.getApp().request(
        `/certs${path}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            origin: ApiHarnessOrigin,
            'x-real-ip': '198.51.100.1',
            ...headers,
          },
          body: new URLSearchParams(fields).toString(),
        },
        { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
      ),
    );

  const createUser = async (
    data: { email?: string; role?: Role; mustChangePassword?: boolean } = {},
  ): Promise<User> =>
    database
      .getRepositories()
      .users.create({
        email: normalizeEmail(data.email ?? 'ana@example.org'),
        passwordHash: await passwords.hash(ApiHarnessPassword),
        role: data.role ?? RoleEnum.Editor,
        mustChangePassword: data.mustChangePassword ?? false,
      })
      .unwrap();

  /** Creates a user and returns them with a session cookie. */
  const loginAs = async (
    data: Parameters<typeof createUser>[0] = {},
  ): Promise<{ user: User; cookie: string }> => {
    const user = await createUser(data);
    const response = await request('POST', '/auth/login', {
      body: { email: user.email, password: ApiHarnessPassword },
    });

    return { user, cookie: sessionCookie(response) };
  };

  /** The API's routes as `METHOD /path`, relative to /certs/api, without middleware entries. */
  const listRoutes = (): string[] => [
    ...new Set(
      api
        .getApp()
        .routes.filter(({ method }) => method !== 'ALL')
        .map(({ method, path }) => `${method} ${path.replace(/^\/api/, '')}`),
    ),
  ];

  return { createUser, listRoutes, loginAs, postForm, request, requestPublic };
}
