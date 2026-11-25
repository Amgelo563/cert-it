import {
  ClientIpResolver,
  ResponseCompressor,
  ResponseRevalidator,
  SiteUrl,
} from '@cert-it/hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { brotliDecompressSync } from 'node:zlib';
import { LocaleEnum } from '@cert-it/shared';
import { afterAll, afterEach, describe, expect, test } from 'vite-plus/test';
import { AdminPanelService } from '../../../src/admin/AdminPanelService';
import { AccelFileServer } from '../../../src/certificate/file/AccelFileServer';
import { CertificateFileRoutes } from '../../../src/certificate/file/CertificateFileRoutes';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { ApiService } from '../../../src/http/api/ApiService';
import { HttpService } from '../../../src/http/HttpService';
import { LocaleResolver } from '../../../src/i18n/LocaleResolver';
import { MessageCatalog } from '../../../src/i18n/MessageCatalog';
import { createAuthOptions } from '../../auth/mocks/createAuthOptions';
import { createPublicPageOptions } from '../../page/mocks/createPublicPageOptions';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { AdminBuildScript, createAdminBuild } from '../mocks/createAdminBuild';
import { MockLogger } from '../../log/mocks/MockLogger';
import {
  createTestBranding,
  TestDefaultFavicon,
} from '../../branding/mocks/createTestBranding';

const build = createAdminBuild();
const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

afterAll(() => build.remove());

function createPanel(
  baseUrl: string,
  directory = build.directory,
  branding: Parameters<typeof createTestBranding>[1] = {},
): AdminPanelService {
  const siteUrl = new SiteUrl({ baseUrl });
  return new AdminPanelService({
    directory,
    siteUrl,
    defaultLocale: LocaleEnum.Es,
    branding: createTestBranding(siteUrl, branding),
  });
}

// through HttpService, which sets the locale and the security headers
function createHttp(adminPanel: AdminPanelService, baseUrl: string) {
  const database = createTestDatabase();
  databases.push(database);

  const siteUrl = new SiteUrl({ baseUrl });
  const http = new HttpService({
    port: 0,
    siteUrl,
    clientIps: new ClientIpResolver({ trustedProxies: [], getConnInfo }),
    database,
    locales: new LocaleResolver({ defaultLocale: LocaleEnum.En }),
    messages: new MessageCatalog(),
    adminPanel,
    certificateFiles: new CertificateFileRoutes({
      database,
      fileServer: new AccelFileServer({ siteUrl }),
      logger: new MockLogger(),
    }),
    ...createPublicPageOptions(database, siteUrl),
    api: new ApiService(createAuthOptions(database, siteUrl)),
    compressor: ResponseCompressor.create(),
    revalidator: ResponseRevalidator.create(),
    logger: new MockLogger(),
  });

  return (path: string, headers: Record<string, string> = {}) =>
    Promise.resolve(
      http
        .getApp()
        .request(
          path,
          { headers },
          { incoming: { socket: { remoteAddress: '127.0.0.1' } } },
        ),
    );
}

async function startedHttp(baseUrl: string) {
  const panel = createPanel(baseUrl);
  await panel.start();
  return createHttp(panel, baseUrl);
}

describe.each([
  { baseUrl: 'https://certs.example.org', base: '' },
  { baseUrl: 'https://example.org/certs', base: '/certs' },
])('AdminPanelService ($baseUrl)', ({ baseUrl, base }) => {
  test.each(['/admin', '/admin/', '/admin/template-designer', '/admin/a/b'])(
    'GIVEN the page %s WHEN requesting it THEN serves the page with the base path injected',
    async (path) => {
      const request = await startedHttp(baseUrl);

      const response = await request(`${base}${path}`, {
        'accept-language': 'es',
      });
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/^text\/html/);
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('content-security-policy')).toBe(
        HttpService.AdminCsp,
      );
      expect(html).toContain(
        `<head><base href="${base}/admin/"><meta name="cert-it-default-locale" content="es">`,
      );
      expect(html).toContain('<html lang="es">');
      expect(html).toContain('src="./assets/index-abc123.js"');
    },
  );

  test('GIVEN a hashed asset WHEN requesting it THEN serves it with immutable caching and the admin CSP', async () => {
    const request = await startedHttp(baseUrl);

    const response = await request(`${base}/admin/assets/index-abc123.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/javascript/);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(response.headers.get('content-security-policy')).toBe(
      HttpService.AdminCsp,
    );
    expect(await response.text()).toBe(AdminBuildScript);
  });

  test('GIVEN a browser that accepts brotli WHEN requesting an asset THEN serves the precompressed file', async () => {
    const request = await startedHttp(baseUrl);

    const response = await request(`${base}/admin/assets/index-abc123.js`, {
      'accept-encoding': 'gzip, br',
    });
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get('content-encoding')).toBe('br');
    expect(response.headers.get('content-type')).toMatch(/javascript/);
    expect(brotliDecompressSync(body).toString()).toBe(AdminBuildScript);
  });

  test('GIVEN an unhashed file WHEN requesting it THEN asks the browser to revalidate', async () => {
    const request = await startedHttp(baseUrl);

    const response = await request(`${base}/admin/favicon.svg`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  test.each(['/admin/favicon.svg', '/admin/'])(
    'GIVEN the current ETag of %s WHEN revalidating it THEN answers 304',
    async (path) => {
      const request = await startedHttp(baseUrl);
      const first = await request(`${base}${path}`);
      const tag = first.headers.get('etag') ?? '';

      const response = await request(`${base}${path}`, {
        'if-none-match': tag,
      });

      expect(tag).not.toBe('');
      expect(response.status).toBe(304);
      expect(response.headers.get('cache-control')).toBe('no-cache');
    },
  );

  test('GIVEN a hashed asset WHEN requesting it THEN sends no ETag', async () => {
    const request = await startedHttp(baseUrl);

    const response = await request(`${base}/admin/assets/index-abc123.js`);

    expect(response.headers.get('etag')).toBeNull();
  });

  test.each(['/admin/assets/missing-123.js', '/admin/courses/missing.css'])(
    'GIVEN a missing file %s WHEN requesting it THEN answers 404 instead of the page',
    async (path) => {
      const request = await startedHttp(baseUrl);

      const response = await request(`${base}${path}`);

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('<base');
    },
  );

  test('GIVEN a path that leaves the build WHEN requesting it THEN answers 404', async () => {
    const request = await startedHttp(baseUrl);

    const response = await request(
      `${base}/admin/assets/..%2f..%2fpackage.json`,
    );

    expect(response.status).toBe(404);
  });

  test('GIVEN index.html by name WHEN requesting it THEN serves the injected page', async () => {
    const request = await startedHttp(baseUrl);

    const html = await (await request(`${base}/admin/index.html`)).text();

    expect(html).toContain(`<base href="${base}/admin/">`);
  });
});

describe('AdminPanelService (branding)', () => {
  const baseUrl = 'https://example.org/certs';

  test('GIVEN the built-in branding WHEN opening a page THEN injects it with the built-in favicon and no stylesheet', async () => {
    const panel = createPanel(baseUrl);
    await panel.start();
    const request = createHttp(panel, baseUrl);

    const html = await (await request('/certs/admin/')).text();

    expect(html).toContain(
      '<meta name="cert-it-branding" content="{&quot;name&quot;:&quot;cert-it&quot;',
    );
    expect(html).toContain(
      `<link rel="icon" type="image/svg+xml" href="${TestDefaultFavicon}">`,
    );
    expect(html).not.toContain('./favicon.svg');
    expect(html).not.toContain('/branding/');
  });

  test('GIVEN a name and a primary color WHEN opening a page THEN injects them and links the stylesheet before the head ends', async () => {
    const panel = createPanel(baseUrl, build.directory, {
      name: 'Acme <Certs>',
      primaryColor: '#c2185b',
    });
    await panel.start();
    const request = createHttp(panel, baseUrl);

    const html = await (await request('/certs/admin/')).text();
    const content =
      /<meta name="cert-it-branding" content="([^"]+)">/.exec(html)?.[1] ?? '';
    const branding = JSON.parse(
      content
        .replaceAll('&quot;', '"')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&'),
    ) as { name: string; brandShades: string[] };

    expect(branding.name).toBe('Acme <Certs>');
    expect(branding.brandShades[6]).toBe('#c2185b');
    expect(html).toMatch(
      /<link rel="stylesheet" href="\/certs\/branding\/[0-9a-f]{16}\.css"><\/head>/,
    );
  });
});

describe('AdminPanelService (start)', () => {
  test('GIVEN a missing build WHEN starting THEN throws a StartupError naming the path', async () => {
    const panel = createPanel(
      'https://certs.example.org',
      `${build.directory}-missing`,
    );

    await expect(panel.start()).rejects.toThrow(StartupError);
    await expect(panel.start()).rejects.toThrow('build apps/admin first');
  });

  test('GIVEN a panel not started WHEN requesting a page THEN answers 503', async () => {
    const request = createHttp(
      createPanel('https://certs.example.org'),
      'https://certs.example.org',
    );

    const response = await request('/admin/');

    expect(response.status).toBe(503);
  });
});
