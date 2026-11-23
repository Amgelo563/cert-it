import { writeFileSync } from 'node:fs';
import { SiteUrl } from '@cert-it/hono';
import { CertificateStatusEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Certificate } from '../../../src/certificate/Certificate';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { MessagesService } from '../../../src/i18n/MessagesService';
import { LinkPreviewService } from '../../../src/page/preview/LinkPreviewService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import {
  ApiHarnessOrigin,
  createApiHarness,
} from '../../http/mocks/createApiHarness';
import { TestDataDirectories } from '../../storage/mocks/TestDataDirectories';
import {
  LinkPreviewThemeColor,
  type LinkPreviewSettings,
  PublicPageOrgName,
} from '../mocks/createPublicPageOptions';

// a PNG's signature is enough for a route that never decodes it
const ImageBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const Immutable = 'public, max-age=31536000, immutable';

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

function issue(holder = 'Jürgen Müller'): Certificate {
  const course = seeder.course({ name: 'Applied Statistics' });
  return seeder.certificate(
    seeder.participant(course, { name: holder }),
    seeder.templateVersion(course, seeder.user()),
  );
}

async function openPage(
  path: string,
  linkPreviews: LinkPreviewSettings = {},
): Promise<string> {
  const harness = createApiHarness(database, { linkPreviews });
  return (await harness.requestPublic(path)).text();
}

function meta(attribute: 'property' | 'name', key: string, value: string) {
  return `<meta ${attribute}="${key}" content="${value}"/>`;
}

describe('LinkPreviewService (certificate page)', () => {
  test('GIVEN the default config WHEN opening a certificate page THEN describes it with the page texts and no image', async () => {
    const certificate = issue();

    const page = await openPage(`/c/${certificate.code}`);

    expect(page).toContain(meta('property', 'og:type', 'website'));
    expect(page).toContain(meta('property', 'og:site_name', PublicPageOrgName));
    expect(page).toContain(
      meta('property', 'og:title', 'Jürgen Müller, Applied Statistics'),
    );
    expect(page).toContain(
      meta(
        'property',
        'og:description',
        'Certificate of Jürgen Müller for Applied Statistics.',
      ),
    );
    expect(page).toContain(
      meta(
        'property',
        'og:url',
        `${ApiHarnessOrigin}/certs/c/${certificate.code}`,
      ),
    );
    expect(page).toContain(meta('name', 'twitter:card', 'summary'));
    expect(page).toContain(meta('name', 'theme-color', LinkPreviewThemeColor));
    expect(page).not.toContain('og:image');
  });

  test('GIVEN configured texts WHEN opening a certificate page THEN fills their placeholders', async () => {
    const certificate = issue();

    const page = await openPage(`/c/${certificate.code}`, {
      title: '{name} · {course}',
      description: '{org}, {date}, {code}: {status}. {unknown}',
    });

    expect(page).toContain(
      meta('property', 'og:title', 'Jürgen Müller · Applied Statistics'),
    );
    expect(page).toContain(
      meta(
        'property',
        'og:description',
        `${PublicPageOrgName}, November 18, 2026, ${certificate.code}: Valid. {unknown}`,
      ),
    );
    // the tab title stays the page's own
    expect(page).toContain('<title>Jürgen Müller, Applied Statistics</title>');
  });

  test('GIVEN a revoked certificate WHEN its description has {status} THEN says Revoked', async () => {
    const certificate = issue();
    database
      .getRepositories()
      .certificates.update(certificate.id, {
        status: CertificateStatusEnum.Revoked,
        revokedAt: new Date('2026-11-20T15:00:00Z'),
        revokedReason: 'Issued by mistake',
      })
      .unwrap();

    const page = await openPage(`/c/${certificate.code}`, {
      description: 'Status: {status}',
    });

    expect(page).toContain(
      meta('property', 'og:description', 'Status: Revoked'),
    );
  });

  test('GIVEN a holder name with HTML WHEN opening the page THEN escapes it in the tags', async () => {
    const certificate = issue('"><script>x</script>');

    const page = await openPage(`/c/${certificate.code}`);

    expect(page).not.toContain('<script>x</script>');
    expect(page).toContain(
      'content="&quot;&gt;&lt;script&gt;x&lt;/script&gt;, Applied Statistics"',
    );
  });

  test('GIVEN an unknown code WHEN opening its page THEN has no link preview', async () => {
    const page = await openPage('/c/UNKNOWN1');

    expect(page).not.toContain('og:');
  });
});

describe('LinkPreviewService (lookup page)', () => {
  test('GIVEN the default config WHEN opening the lookup page THEN describes it with its own texts', async () => {
    const page = await openPage('/', {
      title: 'Ignored {name}',
      description: 'Ignored {name}',
    });

    expect(page).toContain(meta('property', 'og:title', 'Find my certificate'));
    expect(page).toContain(
      meta(
        'property',
        'og:description',
        `Find your certificate from ${PublicPageOrgName} with your email and course.`,
      ),
    );
    expect(page).toContain(
      meta('property', 'og:url', `${ApiHarnessOrigin}/certs/`),
    );
  });
});

describe('LinkPreviewService (image)', () => {
  test('GIVEN an https image WHEN opening a page THEN links it, large, with its type and alt', async () => {
    const certificate = issue();

    const page = await openPage(`/c/${certificate.code}`, {
      image: 'https://cdn.example.org/preview.JPG',
      imageAlt: 'Acme logo',
    });

    expect(page).toContain(
      meta('property', 'og:image', 'https://cdn.example.org/preview.JPG'),
    );
    expect(page).toContain(meta('property', 'og:image:type', 'image/jpeg'));
    expect(page).toContain(meta('property', 'og:image:alt', 'Acme logo'));
    expect(page).toContain(meta('name', 'twitter:card', 'summary_large_image'));
  });

  test('GIVEN an image and large_image off WHEN opening a page THEN asks for a thumbnail', async () => {
    const page = await openPage('/', {
      image: 'https://cdn.example.org/preview',
      largeImage: false,
    });

    expect(page).toContain(meta('name', 'twitter:card', 'summary'));
    expect(page).not.toContain('og:image:type');
    expect(page).not.toContain('og:image:alt');
  });

  test('GIVEN a local image WHEN opening a page THEN links it under the app by its hash and serves it as immutable', async () => {
    const dataDirectory = directories.create();
    writeFileSync(dataDirectory.resolve('preview.png'), ImageBytes);
    const harness = createApiHarness(database, {
      dataDirectory,
      linkPreviews: { image: 'preview.png' },
    });

    const page = await (await harness.requestPublic('/')).text();
    const url = /property="og:image" content="([^"]+)"/.exec(page)?.[1] ?? '';
    const path = url.slice(`${ApiHarnessOrigin}/certs`.length);
    const response = await harness.requestPublic(path);

    expect(url).toMatch(
      new RegExp(`^${ApiHarnessOrigin}/certs/link-preview/[0-9a-f]{16}\\.png$`),
    );
    expect(page).toContain(meta('property', 'og:image:type', 'image/png'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe(Immutable);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(ImageBytes);
  });

  test('GIVEN a local image WHEN requesting another name under its path THEN answers 404', async () => {
    const dataDirectory = directories.create();
    writeFileSync(dataDirectory.resolve('preview.png'), ImageBytes);
    const harness = createApiHarness(database, {
      dataDirectory,
      linkPreviews: { image: 'preview.png' },
    });

    const response = await harness.requestPublic('/link-preview/preview.png');

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('GIVEN a local image that is missing WHEN starting THEN fails with a StartupError', () => {
    const service = new LinkPreviewService({
      siteUrl: new SiteUrl({ baseUrl: `${ApiHarnessOrigin}/certs` }),
      dataDirectory: directories.create(),
      messages: new MessagesService(),
      siteName: PublicPageOrgName,
      image: 'missing.png',
      largeImage: true,
      themeColor: LinkPreviewThemeColor,
    });

    expect(() => service.start()).toThrow(StartupError);
  });

  test('GIVEN a local image outside the data directory WHEN starting THEN fails with a StartupError', () => {
    const service = new LinkPreviewService({
      siteUrl: new SiteUrl({ baseUrl: `${ApiHarnessOrigin}/certs` }),
      dataDirectory: directories.create(),
      messages: new MessagesService(),
      siteName: PublicPageOrgName,
      image: '../outside.png',
      largeImage: true,
      themeColor: LinkPreviewThemeColor,
    });

    expect(() => service.start()).toThrow(StartupError);
  });
});
