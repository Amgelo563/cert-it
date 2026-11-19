import { createServer, type Server } from 'node:net';
import { once } from 'node:events';
import { LocaleEnum } from '@cert-it/shared';
import { afterAll, afterEach, describe, expect, test } from 'vite-plus/test';
import { AdminPanelService } from '../../../src/admin/AdminPanelService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { ClientIpResolver } from '../../../src/http/clientIp/ClientIpResolver';
import { ResponseCompressor } from '../../../src/http/compression/ResponseCompressor';
import { HttpService } from '../../../src/http/HttpService';
import { ResponseRevalidator } from '../../../src/http/revalidation/ResponseRevalidator';
import { SiteUrl } from '../../../src/http/url/SiteUrl';
import { LocaleResolver } from '../../../src/i18n/LocaleResolver';
import { MessagesService } from '../../../src/i18n/MessagesService';
import { createAdminBuild } from '../../admin/mocks/createAdminBuild';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';

const databases: DatabaseService[] = [];
const adminBuild = createAdminBuild();

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

afterAll(() => adminBuild.remove());

function createAdminPanel(siteUrl: SiteUrl): AdminPanelService {
  return new AdminPanelService({
    directory: adminBuild.directory,
    siteUrl,
    defaultLocale: LocaleEnum.Es,
  });
}

function createHttp(baseUrl: string, lines: string[] = []): HttpService {
  const database = createTestDatabase();
  databases.push(database);

  const siteUrl = new SiteUrl({ baseUrl });

  return new HttpService({
    port: 0,
    siteUrl,
    clientIps: new ClientIpResolver({ trustedProxies: ['127.0.0.0/8'] }),
    database,
    locales: new LocaleResolver({ defaultLocale: LocaleEnum.En }),
    messages: new MessagesService(),
    adminPanel: createAdminPanel(siteUrl),
    compressor: new ResponseCompressor(),
    revalidator: new ResponseRevalidator(),
    log: (line) => lines.push(line),
  });
}

function request(
  http: HttpService,
  path: string,
  headers: Record<string, string> = {},
  remoteAddress = '127.0.0.1',
): Promise<Response> {
  return Promise.resolve(
    http
      .getApp()
      .request(path, { headers }, { incoming: { socket: { remoteAddress } } }),
  );
}

describe.each([
  { baseUrl: 'https://certs.example.org', base: '' },
  { baseUrl: 'https://example.org/certs', base: '/certs' },
])('HttpService ($baseUrl)', ({ baseUrl, base }) => {
  test('GIVEN a started database WHEN requesting healthz under the base path THEN answers ok', async () => {
    const response = await request(createHttp(baseUrl), `${base}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('GIVEN any base path WHEN requesting healthz at the root THEN answers ok', async () => {
    const response = await request(createHttp(baseUrl), '/healthz');

    expect(response.status).toBe(200);
  });

  test('GIVEN a closed database WHEN requesting healthz THEN answers 503', async () => {
    const http = createHttp(baseUrl);
    databases.at(-1)?.close();

    const response = await request(http, `${base}/healthz`);

    expect(response.status).toBe(503);
  });

  test('GIVEN a public page WHEN requesting it THEN sends the security headers and the public CSP', async () => {
    const response = await request(createHttp(baseUrl), `${base}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBe(
      HttpService.PublicCsp,
    );
  });

  test.each(['/admin', '/admin/', '/admin/x'])(
    'GIVEN the admin path %s WHEN requesting it THEN sends the admin CSP',
    async (path) => {
      const response = await request(createHttp(baseUrl), `${base}${path}`);

      expect(response.headers.get('content-security-policy')).toBe(
        HttpService.AdminCsp,
      );
    },
  );

  test('GIVEN a path that only starts like admin WHEN requesting it THEN sends the public CSP', async () => {
    const response = await request(
      createHttp(baseUrl),
      `${base}/administrator`,
    );

    expect(response.headers.get('content-security-policy')).toBe(
      HttpService.PublicCsp,
    );
  });

  test.skipIf(base !== '')(
    'GIVEN an HTTPS base URL WHEN requesting THEN sends HSTS without includeSubDomains',
    async () => {
      const response = await request(createHttp(baseUrl), `${base}/`);
      const hsts = response.headers.get('strict-transport-security');

      expect(hsts).toMatch(/^max-age=\d+$/);
    },
  );

  test('GIVEN a request through a trusted proxy WHEN logged THEN shows the forwarded IP and no query', async () => {
    const lines: string[] = [];
    const http = createHttp(baseUrl, lines);

    await request(http, `${base}/?email=a@b.c`, {
      'x-real-ip': '198.51.100.7',
    });

    expect(lines).toEqual([
      expect.stringMatching(
        new RegExp(`^GET ${base}/ 200 \\d+ms 198\\.51\\.100\\.7$`),
      ),
    ]);
  });

  test('GIVEN a healthz request WHEN handled THEN is not logged', async () => {
    const lines: string[] = [];
    const http = createHttp(baseUrl, lines);

    await request(http, `${base}/healthz`);
    await request(http, '/healthz');

    expect(lines).toEqual([]);
  });
});

describe.each([
  { baseUrl: 'https://certs.example.org', base: '', cookiePath: '/' },
  {
    baseUrl: 'https://example.org/certs',
    base: '/certs',
    cookiePath: '/certs',
  },
])('HttpService (locale, $baseUrl)', ({ baseUrl, base, cookiePath }) => {
  // answers with the resolved locale and a text in it, to see what the middleware set
  function createLocaleHttp(): HttpService {
    const http = createHttp(baseUrl);
    http
      .getApp()
      .get(`${base}/locale`, (c) =>
        c.text(
          `${c.get('locale')} ${c.get('messages').get(c.get('locale')).language.name}`,
        ),
      );
    return http;
  }

  test('GIVEN a supported ?lang= WHEN requesting THEN uses it and saves it in a cookie under the base path', async () => {
    const response = await request(
      createLocaleHttp(),
      `${base}/locale?lang=es`,
    );
    const cookie = response.headers.get('set-cookie') ?? '';

    expect(await response.text()).toBe('es Español');
    expect(cookie).toMatch(/^lang=es;/);
    expect(cookie).toContain(`Path=${cookiePath};`);
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('HttpOnly');
  });

  test('GIVEN an unsupported ?lang= WHEN requesting THEN sets no cookie and falls back', async () => {
    const response = await request(
      createLocaleHttp(),
      `${base}/locale?lang=fr`,
      {
        'accept-language': 'es-PE,es;q=0.9',
      },
    );

    expect(await response.text()).toBe('es Español');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  test('GIVEN a lang cookie and another browser language WHEN requesting THEN prefers the cookie', async () => {
    const response = await request(createLocaleHttp(), `${base}/locale`, {
      cookie: 'lang=es',
      'accept-language': 'en',
    });

    expect(await response.text()).toBe('es Español');
  });

  test('GIVEN no preference WHEN requesting THEN uses the default locale', async () => {
    const response = await request(createLocaleHttp(), `${base}/locale`);

    expect(await response.text()).toBe('en English');
  });
});

describe('HttpService (base path)', () => {
  test('GIVEN a base path WHEN requesting a route outside it THEN answers 404 with security headers', async () => {
    const response = await request(
      createHttp('https://example.org/certs'),
      '/',
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('GIVEN an HTTP base URL WHEN requesting THEN sends no HSTS', async () => {
    const response = await request(createHttp('http://localhost:3000'), '/');

    expect(response.headers.get('strict-transport-security')).toBeNull();
  });
});

describe('HttpService (start)', () => {
  let blocker: Server | null = null;

  afterEach(() => {
    blocker?.close();
    blocker = null;
  });

  test('GIVEN a taken port WHEN starting THEN throws a StartupError naming the port', async () => {
    blocker = createServer().listen(0);
    await once(blocker, 'listening');
    const address = blocker.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const database = createTestDatabase();
    databases.push(database);
    const siteUrl = new SiteUrl({ baseUrl: 'https://certs.example.org' });
    const http = new HttpService({
      port,
      siteUrl,
      clientIps: new ClientIpResolver({ trustedProxies: [] }),
      database,
      locales: new LocaleResolver({ defaultLocale: LocaleEnum.En }),
      messages: new MessagesService(),
      adminPanel: createAdminPanel(siteUrl),
      compressor: new ResponseCompressor(),
      revalidator: new ResponseRevalidator(),
      log: () => {},
    });

    await expect(http.start()).rejects.toThrow(StartupError);
    await expect(http.start()).rejects.toThrow(`port ${port}`);
  });
});
