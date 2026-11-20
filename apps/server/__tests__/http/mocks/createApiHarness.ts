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
import { CertificateFileService } from '../../../src/certificate/file/CertificateFileService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { HttpService } from '../../../src/http/HttpService';
import { LocaleResolver } from '../../../src/i18n/LocaleResolver';
import { MessagesService } from '../../../src/i18n/MessagesService';
import type { User } from '../../../src/user/User';
import { normalizeEmail } from '../../../src/util/email/NormalizedEmail';
import { createAuthOptions } from '../../auth/mocks/createAuthOptions';
import { sessionCookie } from '../../auth/mocks/createAuthApp';

export type ApiRequestInit = {
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
  options: { maxAttempts?: number } = {},
) {
  const siteUrl = new SiteUrl({ baseUrl: `${ApiHarnessOrigin}/certs` });
  const http = new HttpService({
    port: 0,
    siteUrl,
    clientIps: new ClientIpResolver({
      trustedProxies: ['127.0.0.0/8'],
      getConnInfo,
    }),
    database,
    locales: new LocaleResolver({ defaultLocale: LocaleEnum.En }),
    messages: new MessagesService(),
    adminPanel: new AdminPanelService({
      directory: '.',
      siteUrl,
      defaultLocale: LocaleEnum.En,
    }),
    certificateFiles: new CertificateFileService({
      database,
      fileServer: new AccelFileServer({ siteUrl }),
    }),
    ...createAuthOptions(database, siteUrl, options),
    compressor: new ResponseCompressor(),
    revalidator: new ResponseRevalidator(),
    log: () => {},
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
    if (init.body !== undefined) headers['content-type'] = 'application/json';

    return Promise.resolve(
      http.getApp().request(
        `/certs/api${path}`,
        {
          method,
          headers,
          body:
            typeof init.body === 'string' || init.body === undefined
              ? init.body
              : JSON.stringify(init.body),
        },
        { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
      ),
    );
  };

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

  return { createUser, loginAs, request };
}
