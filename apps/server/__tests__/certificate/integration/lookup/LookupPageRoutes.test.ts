import { CertificateStatusEnum, LocaleEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Certificate } from '../../../../src/certificate/Certificate';
import type { Course } from '../../../../src/course/Course';
import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import { createApiHarness } from '../../../http/mocks/createApiHarness';
import {
  LookupMaxRequests,
  PublicBuildFiles,
  PublicPageOrgName,
} from '../../../page/mocks/createPublicPageOptions';

const NotFoundText = 'We couldn&#39;t find a certificate with those details.';

let database: DatabaseService;
let seeder: MockSeeder;
let harness: ReturnType<typeof createApiHarness>;

beforeEach(() => {
  database = createTestDatabase();
  seeder = new MockSeeder(database.getRepositories());
  harness = createApiHarness(database);
});

afterEach(() => {
  database.close();
});

function issue(course: Course, email: string): Certificate {
  return seeder.certificate(
    seeder.participant(course, { email }),
    seeder.templateVersion(course, seeder.user()),
  );
}

function lookup(
  course: Course | string,
  email: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  const id = typeof course === 'string' ? course : String(course.id);
  return harness.postForm('/', { email, course: id }, headers);
}

describe('LookupPageRoutes (page)', () => {
  test('GIVEN courses with lookup on and off WHEN opening the page THEN lists only the active ones with lookup on', async () => {
    seeder.course({ name: 'Applied Statistics' });
    seeder.course({ name: 'Hidden Course', lookupEnabled: false });
    seeder.course({ name: 'Archived Course', active: false });

    const response = await harness.requestPublic('/');
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(page).toMatch(/^<!doctype html>/);
    expect(page).toContain('Find my certificate');
    expect(page).toContain(PublicPageOrgName);
    expect(page).toContain('Applied Statistics');
    expect(page).not.toContain('Hidden Course');
    expect(page).not.toContain('Archived Course');
    expect(page).toContain(
      '<form class="lookup-form" method="post" action="/certs/"',
    );
  });

  test('GIVEN the page WHEN opening it with ?lang=es THEN shows it in Spanish with the language switcher', async () => {
    seeder.course();

    const page = await (await harness.requestPublic('/?lang=es')).text();

    expect(page).toContain('<html lang="es">');
    expect(page).toContain(
      '<nav class="language-switcher-menu" aria-label="Idioma">',
    );
    expect(page).toContain('href="?lang=en"');
    expect(page).toContain(
      '<a href="?lang=es" hreflang="es" lang="es" aria-current="true">',
    );
  });

  test('GIVEN the page WHEN opening it THEN links the lookup styles without inline code', async () => {
    seeder.course();

    const page = await (await harness.requestPublic('/')).text();

    expect(page).toContain(
      `<script type="module" src="/certs/static/${PublicBuildFiles.lookupScript}"></script>`,
    );
    expect(page).toContain(
      `<link rel="stylesheet" href="/certs/static/${PublicBuildFiles.style}"/>`,
    );
    expect(page).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(page).not.toMatch(/<style\b|\sstyle="/);
  });

  test('GIVEN no course in the lookup WHEN opening the page THEN shows a message instead of the form', async () => {
    seeder.course({ lookupEnabled: false });

    const page = await (await harness.requestPublic('/')).text();

    expect(page).toContain('No courses can be searched right now.');
    expect(page).not.toContain('<form');
  });

  test('GIVEN a Spanish visitor WHEN opening the page THEN shows it in Spanish', async () => {
    seeder.course();

    const page = await (
      await harness.requestPublic('/', { 'accept-language': 'es' })
    ).text();

    expect(page).toContain(`<html lang="${LocaleEnum.Es}">`);
    expect(page).toContain('Buscar mi certificado');
  });
});

describe('LookupPageRoutes (lookup)', () => {
  test('GIVEN an active certificate WHEN looking it up THEN redirects to its page', async () => {
    const course = seeder.course();
    const certificate = issue(course, 'ana@example.org');

    const response = await lookup(course, 'ana@example.org');

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `/certs/c/${certificate.code}`,
    );
  });

  test('GIVEN an email in another case and with spaces WHEN looking it up THEN still finds it', async () => {
    const course = seeder.course();
    const certificate = issue(course, 'ana@example.org');

    const response = await lookup(course, '  Ana@Example.ORG ');

    expect(response.headers.get('location')).toBe(
      `/certs/c/${certificate.code}`,
    );
  });

  test('GIVEN a revoked certificate WHEN looking it up THEN answers like a miss', async () => {
    const course = seeder.course();
    const certificate = issue(course, 'ana@example.org');
    database
      .getRepositories()
      .certificates.update(certificate.id, {
        status: CertificateStatusEnum.Revoked,
        revokedAt: new Date(),
        revokedReason: 'Duplicate',
      })
      .unwrap();

    const response = await lookup(course, 'ana@example.org');
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain(NotFoundText);
    expect(page).not.toContain(certificate.code);
  });

  test('GIVEN misses of every kind WHEN looking them up THEN all answer with the same page', async () => {
    const course = seeder.course();
    const other = seeder.course();
    const hidden = seeder.course({ lookupEnabled: false });
    issue(other, 'ana@example.org');
    issue(hidden, 'bea@example.org');
    seeder.participant(course, { email: 'eva@example.org' });

    const pages = await Promise.all(
      [
        lookup(course, 'nobody@example.org'),
        lookup(course, 'ana@example.org'),
        lookup(course, 'eva@example.org'),
        lookup(hidden, 'bea@example.org'),
        lookup('abc', 'ana@example.org'),
        lookup(course, ''),
      ].map(async (request) => {
        const response = await request;
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store');
        // the form echoes what was sent, so leave it out
        return (await response.text())
          .replace(/<input id="lookup-email"[^>]*>/, '')
          .replaceAll(' selected=""', '');
      }),
    );

    expect(pages[0]).toContain(NotFoundText);
    expect(pages[0]).toContain(`contact ${PublicPageOrgName}`);
    for (const page of pages.slice(1)) expect(page).toBe(pages[0]);
  });

  test('GIVEN a miss WHEN showing the page again THEN keeps the email and course', async () => {
    const course = seeder.course();

    const page = await (await lookup(course, 'ana@example.org')).text();

    expect(page).toContain('value="ana@example.org"');
    expect(page).toContain(`<option value="${course.id}" selected="">`);
  });
});

describe('LookupPageRoutes (rate limit)', () => {
  test('GIVEN the limit used up WHEN looking up again THEN answers 429 without searching', async () => {
    const course = seeder.course();
    const certificate = issue(course, 'ana@example.org');
    for (let i = 0; i < LookupMaxRequests; i++) {
      await lookup(course, `guess${i}@example.org`);
    }

    const response = await lookup(course, 'ana@example.org');
    const page = await response.text();

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(page).toContain('Too many searches');
    expect(page).not.toContain(certificate.code);
  });

  test('GIVEN one IP over the limit WHEN another IP looks up THEN still answers it', async () => {
    const course = seeder.course();
    const certificate = issue(course, 'ana@example.org');
    for (let i = 0; i <= LookupMaxRequests; i++) {
      await lookup(course, `guess${i}@example.org`);
    }

    const response = await lookup(course, 'ana@example.org', {
      'x-real-ip': '203.0.113.7',
    });

    expect(response.headers.get('location')).toBe(
      `/certs/c/${certificate.code}`,
    );
  });

  test('GIVEN the page WHEN opening it many times THEN never limits it', async () => {
    seeder.course();
    for (let i = 0; i <= LookupMaxRequests; i++) {
      await harness.requestPublic('/');
    }

    expect((await harness.requestPublic('/')).status).toBe(200);
  });
});

describe('LookupPageRoutes (cross-origin)', () => {
  test('GIVEN another site WHEN posting the form THEN answers 403 without searching', async () => {
    const course = seeder.course();
    issue(course, 'ana@example.org');

    const response = await lookup(course, 'ana@example.org', {
      origin: 'https://evil.example',
    });

    expect(response.status).toBe(403);
  });

  test('GIVEN a same-origin form post under no-referrer WHEN posting THEN accepts the null Origin', async () => {
    const course = seeder.course();
    const certificate = issue(course, 'ana@example.org');

    const response = await lookup(course, 'ana@example.org', {
      origin: 'null',
      'sec-fetch-site': 'same-origin',
    });

    expect(response.headers.get('location')).toBe(
      `/certs/c/${certificate.code}`,
    );
  });

  test('GIVEN a cross-site form post under no-referrer WHEN posting THEN answers 403', async () => {
    const course = seeder.course();

    const response = await lookup(course, 'ana@example.org', {
      origin: 'null',
      'sec-fetch-site': 'cross-site',
    });

    expect(response.status).toBe(403);
  });
});
