import { writeFileSync } from 'node:fs';
import { SiteUrl } from '@cert-it/hono';
import { ThemeValues } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { BrandingService } from '../../../src/branding/BrandingService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import {
  ApiHarnessOrigin,
  createApiHarness,
} from '../../http/mocks/createApiHarness';
import { PublicPageOrgName } from '../../page/mocks/createPublicPageOptions';
import { TestDataDirectories } from '../../storage/mocks/TestDataDirectories';
import type { createTestBranding } from '../mocks/createTestBranding';
import { TestDefaultFavicon } from '../mocks/createTestBranding';

// a PNG's signature is enough for routes that never decode it
const ImageBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const Immutable = 'public, max-age=31536000, immutable';

const HashedFile = (extension: string) =>
  new RegExp(`^/certs/branding/[0-9a-f]{16}\\.${extension}$`);

let database: DatabaseService;
let seeder: MockSeeder;
const directories = new TestDataDirectories();

beforeEach(() => {
  database = createTestDatabase();
  seeder = new MockSeeder(database.getRepositories());
});

afterEach(() => {
  database.close();
  directories.removeAll();
});

function harnessWith(
  files: Record<string, Uint8Array | string>,
  branding: Parameters<typeof createTestBranding>[1],
) {
  const dataDirectory = directories.create();
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(dataDirectory.resolve(name), content);
  }
  return createApiHarness(database, {
    dataDirectory,
    branding: { dataDirectory, ...branding },
  });
}

function attribute(page: string, pattern: RegExp): string {
  return pattern.exec(page)?.[1] ?? '';
}

function certificatePage(): string {
  const course = seeder.course();
  const certificate = seeder.certificate(
    seeder.participant(course),
    seeder.templateVersion(course, seeder.user()),
  );
  return `/c/${certificate.code}`;
}

describe('BrandingService (defaults)', () => {
  test('GIVEN the built-in branding WHEN opening a public page THEN links the built-in favicon, no stylesheet and shows the org name', async () => {
    const harness = createApiHarness(database);

    const page = await (await harness.requestPublic('/')).text();

    expect(page).toContain(
      `<link rel="icon" type="image/svg+xml" href="${TestDefaultFavicon}"/>`,
    );
    expect(page).not.toContain('/branding/');
    expect(page).toContain(
      `<span class="site-org">${PublicPageOrgName}</span>`,
    );
  });

  test('GIVEN the built-in branding WHEN reading the admin branding THEN has the built-in shades and font', () => {
    const service = new BrandingService({
      siteUrl: new SiteUrl({ baseUrl: `${ApiHarnessOrigin}/certs` }),
      dataDirectory: directories.create(),
      name: 'cert-it',
      primaryColor: '#0050B4',
      defaultFavicon: TestDefaultFavicon,
    });
    service.start();

    expect(service.getAdminBranding()).toEqual({
      name: 'cert-it',
      brandShades: ThemeValues.brandShades,
      logo: null,
      logoDark: null,
      fontFamily: ThemeValues.fontFamily,
    });
    expect(service.getPublicBranding().stylesheet).toBeNull();
  });
});

describe('BrandingService (colors and font)', () => {
  test('GIVEN a primary color WHEN opening a public page THEN links a stylesheet with its shades after the page styles', async () => {
    const harness = createApiHarness(database, {
      branding: { primaryColor: '#c2185b' },
    });

    const page = await (await harness.requestPublic('/')).text();
    const href = attribute(
      page,
      /<link rel="stylesheet" href="([^"]+\/branding\/[^"]+)"/,
    );
    const response = await harness.requestPublic(href.slice('/certs'.length));
    const css = await response.text();

    expect(href).toMatch(HashedFile('css'));
    expect(page.indexOf(href)).toBeGreaterThan(page.indexOf('/static/'));
    expect(response.headers.get('content-type')).toBe(
      'text/css; charset=utf-8',
    );
    expect(response.headers.get('cache-control')).toBe(Immutable);
    expect(css).toContain('--brand-6: #c2185b;');
    expect(css).toMatch(/--brand-0: #[0-9a-f]{6};/);
    expect(css).not.toContain('@font-face');
  });

  test('GIVEN a font file WHEN fetching the stylesheet THEN declares it next to the stylesheet and uses it first', async () => {
    const harness = harnessWith(
      { 'brand.woff2': 'wOF2' },
      { font: 'brand.woff2' },
    );

    const page = await (await harness.requestPublic('/')).text();
    const href = attribute(
      page,
      /<link rel="stylesheet" href="([^"]+\/branding\/[^"]+)"/,
    );
    const css = await (
      await harness.requestPublic(href.slice('/certs'.length))
    ).text();
    const font = /url\('([0-9a-f]{16}\.woff2)'\) format\('woff2'\)/.exec(
      css,
    )?.[1];
    const fontResponse = await harness.requestPublic(`/branding/${font}`);

    expect(font).toBeDefined();
    expect(css).toContain("--font: 'cert-it brand', ");
    expect(css).not.toContain('--brand-');
    expect(fontResponse.status).toBe(200);
    expect(fontResponse.headers.get('content-type')).toBe('font/woff2');
  });
});

describe('BrandingService (images)', () => {
  test('GIVEN a logo and a dark logo WHEN opening a public page THEN shows them in place of the org name', async () => {
    const harness = harnessWith(
      { 'logo.png': ImageBytes, 'logo-dark.svg': '<svg></svg>' },
      { logo: 'logo.png', logoDark: 'logo-dark.svg' },
    );

    const page = await (await harness.requestPublic(certificatePage())).text();
    const logo = attribute(page, /<img src="([^"]+)" alt="Acme Institute"/);
    const dark = attribute(
      page,
      /<source srcset="([^"]+)" media="\(prefers-color-scheme: dark\)"/,
    );
    const response = await harness.requestPublic(logo.slice('/certs'.length));

    expect(logo).toMatch(HashedFile('png'));
    expect(dark).toMatch(HashedFile('svg'));
    expect(page).not.toContain('class="site-org"');
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe(Immutable);
  });

  test('GIVEN a favicon WHEN opening a public page THEN links it by its hash and type', async () => {
    const harness = harnessWith(
      { 'icon.png': ImageBytes },
      { favicon: 'icon.png' },
    );

    const page = await (await harness.requestPublic('/')).text();
    const href = attribute(
      page,
      /<link rel="icon" type="image\/png" href="([^"]+)"/,
    );

    expect(href).toMatch(HashedFile('png'));
  });

  test('GIVEN a lookup image WHEN opening the lookup page THEN shows it in place of the drawing', async () => {
    const harness = harnessWith(
      { 'art.webp': ImageBytes },
      { lookupImage: 'art.webp' },
    );
    seeder.course({ lookupEnabled: true });

    const page = await (await harness.requestPublic('/')).text();

    expect(
      attribute(page, /<img class="lookup-art-image" src="([^"]+)"/),
    ).toMatch(HashedFile('webp'));
    expect(page).not.toContain('lookup-art-drawing');
  });

  test('GIVEN a configured file WHEN requesting another name under the path THEN answers 404 without caching', async () => {
    const harness = harnessWith(
      { 'logo.png': ImageBytes },
      { logo: 'logo.png' },
    );

    const response = await harness.requestPublic('/branding/logo.png');

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('GIVEN a missing file WHEN starting THEN fails with a StartupError naming it', () => {
    const service = new BrandingService({
      siteUrl: new SiteUrl({ baseUrl: `${ApiHarnessOrigin}/certs` }),
      dataDirectory: directories.create(),
      name: 'cert-it',
      primaryColor: '#0050b4',
      logo: 'missing.png',
      defaultFavicon: TestDefaultFavicon,
    });

    expect(() => service.start()).toThrow(StartupError);
    expect(() => service.start()).toThrow(/logo missing\.png/);
  });
});
