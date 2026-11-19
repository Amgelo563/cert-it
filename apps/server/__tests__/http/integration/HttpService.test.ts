import { createServer, type Server } from 'node:net';
import { once } from 'node:events';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { ClientIpResolver } from '../../../src/http/clientIp/ClientIpResolver';
import { HttpService } from '../../../src/http/HttpService';
import { SiteUrl } from '../../../src/http/url/SiteUrl';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function createHttp(baseUrl: string, lines: string[] = []): HttpService {
  const database = createTestDatabase();
  databases.push(database);

  return new HttpService({
    port: 0,
    siteUrl: new SiteUrl({ baseUrl }),
    clientIps: new ClientIpResolver({ trustedProxies: ['127.0.0.0/8'] }),
    database,
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
  { baseUrl: 'https://example.org/certificados', base: '/certificados' },
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

  test('GIVEN an HTTPS base URL WHEN requesting THEN sends HSTS without includeSubDomains', async () => {
    const response = await request(createHttp(baseUrl), `${base}/`);
    const hsts = response.headers.get('strict-transport-security');

    expect(hsts).toMatch(/^max-age=\d+$/);
  });

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

describe('HttpService (base path)', () => {
  test('GIVEN a base path WHEN requesting a route outside it THEN answers 404 with security headers', async () => {
    const response = await request(
      createHttp('https://example.org/certificados'),
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
    const http = new HttpService({
      port,
      siteUrl: new SiteUrl({ baseUrl: 'https://certs.example.org' }),
      clientIps: new ClientIpResolver({ trustedProxies: [] }),
      database,
      log: () => {},
    });

    await expect(http.start()).rejects.toThrow(StartupError);
    await expect(http.start()).rejects.toThrow(`port ${port}`);
  });
});
