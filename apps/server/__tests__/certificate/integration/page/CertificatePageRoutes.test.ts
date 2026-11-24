import {
  CertificateStatusEnum,
  LocaleCookieName,
  LocaleEnum,
} from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Certificate } from '../../../../src/certificate/Certificate';
import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { HttpService } from '../../../../src/http/HttpService';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import {
  ApiHarnessOrigin,
  createApiHarness,
} from '../../../http/mocks/createApiHarness';
import {
  PublicBuildFiles,
  PublicPageLinkedInOrgId,
  PublicPageOrgName,
} from '../../../page/mocks/createPublicPageOptions';

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

function issue(
  options: Parameters<MockSeeder['course']>[0] & {
    holder?: string;
    email?: string;
  } = {},
): Certificate {
  const { holder, email, ...courseOptions } = options;
  const course = seeder.course({
    name: 'Applied Statistics',
    ...courseOptions,
  });
  return seeder.certificate(
    seeder.participant(course, { name: holder ?? 'Jürgen Müller', email }),
    seeder.templateVersion(course, seeder.user()),
  );
}

// the LinkedIn button's link, with its HTML escaping undone
function linkedInLink(page: string): URL | null {
  const href = /<a class="button button-linkedin" href="([^"]+)"/.exec(
    page,
  )?.[1];
  return href ? new URL(href.replaceAll('&amp;', '&')) : null;
}

function revoke(certificate: Certificate, reason: string): void {
  database
    .getRepositories()
    .certificates.update(certificate.id, {
      status: CertificateStatusEnum.Revoked,
      revokedAt: new Date('2026-11-20T15:00:00Z'),
      revokedReason: reason,
    })
    .unwrap();
}

describe('CertificatePageRoutes (active certificate)', () => {
  test('GIVEN an active certificate WHEN opening its page THEN shows its details and status', async () => {
    const certificate = issue();

    const response = await harness.requestPublic(`/c/${certificate.code}`);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/html/);
    expect(page).toMatch(/^<!doctype html>/);
    expect(page).toContain('<html lang="en">');
    expect(page).toContain('Valid certificate');
    expect(page).toContain('Jürgen Müller');
    expect(page).toContain('Applied Statistics');
    expect(page).toContain('November 18, 2026');
    expect(page).toContain(PublicPageOrgName);
    expect(page).toContain(certificate.code);
  });

  test('GIVEN an active certificate WHEN opening its page THEN links the preview, both downloads and copy link', async () => {
    const certificate = issue();

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).toContain(`data-pdf-url="/certs/c/${certificate.code}/pdf"`);
    expect(page).toContain(`href="/certs/c/${certificate.code}/pdf"`);
    expect(page).toContain(
      `href="/certs/c/${certificate.code}/pdf?download=1"`,
    );
    expect(page).toContain(
      `href="/certs/c/${certificate.code}/credential" download`,
    );
    expect(page).toContain('aria-label="More download options"');
    expect(page).toContain(
      `data-copy-link="${ApiHarnessOrigin}/certs/c/${certificate.code}"`,
    );
    expect(page).toContain(
      'aria-label="Certificate for Jürgen Müller, Applied Statistics"',
    );
  });

  test('GIVEN an active certificate WHEN opening its page THEN links the built script and styles without inline code', async () => {
    const certificate = issue();

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).toContain(
      `<script type="module" src="/certs/static/${PublicBuildFiles.script}"></script>`,
    );
    expect(page).toContain(
      `<link rel="stylesheet" href="/certs/static/${PublicBuildFiles.style}"/>`,
    );
    expect(page).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(page).not.toMatch(/<style\b|\sstyle="/);
  });

  test('GIVEN an active certificate WHEN opening its page THEN shows a loading skeleton, with the fallback for no JavaScript', async () => {
    const certificate = issue();

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).toContain('class="preview-frame is-loading"');
    expect(page).toContain('Loading preview…');
    expect(page).toContain('<div class="preview-fallback" hidden="">');
    expect(page).toMatch(
      /<noscript><div class="preview-fallback">[\s\S]*Open the PDF[\s\S]*<\/noscript>/,
    );
  });

  test('GIVEN an active certificate WHEN opening its page THEN never shows the email', async () => {
    const certificate = issue({ email: 'hidden.person@example.org' });

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).not.toContain('hidden.person');
  });

  test('GIVEN an active certificate WHEN opening its page THEN sends the public CSP and revalidates on every visit', async () => {
    const certificate = issue();

    const response = await harness.requestPublic(`/c/${certificate.code}`);

    expect(response.headers.get('content-security-policy')).toBe(
      HttpService.PublicCsp,
    );
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('etag')).toBeTruthy();
  });

  test('GIVEN a holder name with HTML WHEN opening the page THEN escapes it', async () => {
    const certificate = issue({ holder: '<script>alert(1)</script>' });

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).not.toContain('<script>alert(1)</script>');
    expect(page).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('CertificatePageRoutes (revoked certificate)', () => {
  test('GIVEN a revoked certificate WHEN opening its page THEN shows the revocation date and reason', async () => {
    const certificate = issue();
    revoke(certificate, 'Issued by mistake');

    const response = await harness.requestPublic(`/c/${certificate.code}`);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain('Revoked certificate');
    expect(page).toContain(
      'This certificate was revoked on November 20, 2026.',
    );
    expect(page).toContain('Reason: Issued by mistake');
    expect(page).not.toContain('Valid certificate');
  });

  test('GIVEN a revoked certificate WHEN opening its page THEN offers no PDF, credential, preview or copy link', async () => {
    const certificate = issue();
    revoke(certificate, 'Issued by mistake');

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).not.toContain('/pdf');
    expect(page).not.toContain('/credential');
    expect(page).not.toContain('data-preview');
    expect(page).not.toContain('data-copy-link');
  });
});

describe('CertificatePageRoutes (LinkedIn)', () => {
  test('GIVEN site.linkedin_org_id WHEN opening an active certificate THEN links to LinkedIn with its details, in a new tab', async () => {
    const certificate = issue();

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();
    const link = linkedInLink(page);

    expect(page).toContain('Add to LinkedIn');
    expect(page).toContain(
      '<span class="visually-hidden"> (opens in a new tab)</span>',
    );
    expect(page).toContain('target="_blank" rel="noopener noreferrer"');
    expect(link?.origin).toBe('https://www.linkedin.com');
    expect(Object.fromEntries(link?.searchParams ?? [])).toEqual({
      startTask: 'CERTIFICATION_NAME',
      name: 'Applied Statistics',
      organizationId: PublicPageLinkedInOrgId,
      issueYear: '2026',
      issueMonth: '11',
      certUrl: `${ApiHarnessOrigin}/certs/c/${certificate.code}`,
      certId: certificate.code,
    });
  });

  test('GIVEN no site.linkedin_org_id WHEN opening an active certificate THEN shows no LinkedIn button', async () => {
    harness = createApiHarness(database, { linkedinOrgId: null });
    const certificate = issue();

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).not.toContain('linkedin');
    expect(page).not.toContain('Add to LinkedIn');
  });

  test('GIVEN a revoked certificate WHEN opening its page THEN shows no LinkedIn button', async () => {
    const certificate = issue();
    revoke(certificate, 'Issued by mistake');

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).not.toContain('linkedin.com');
  });

  test('GIVEN a Spanish course WHEN opening its page THEN labels the button in Spanish', async () => {
    const certificate = issue({ locale: LocaleEnum.Es });

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).toContain('Añadir a LinkedIn');
  });
});

describe('CertificatePageRoutes (unknown and lowercase codes)', () => {
  test('GIVEN an unknown code WHEN opening its page THEN answers 404 with a page that is not cached', async () => {
    const response = await harness.requestPublic('/c/NOPE-NOPE-NO');
    const page = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(page).toContain('Certificate not found');
    expect(page).toContain(PublicPageOrgName);
  });

  test('GIVEN a lowercase code WHEN opening its page THEN redirects to the uppercase one', async () => {
    const certificate = issue();

    const response = await harness.requestPublic(
      `/c/${certificate.code.toLowerCase()}`,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(
      `/certs/c/${certificate.code}`,
    );
  });

  test('GIVEN a lowercase unknown code WHEN opening its page THEN answers 404', async () => {
    const response = await harness.requestPublic('/c/nope-nope-no');

    expect(response.status).toBe(404);
  });
});

describe('CertificatePageRoutes (language)', () => {
  const spanishCourse = {
    locale: LocaleEnum.Es,
    dateFormat: 'D [de] MMMM [de] YYYY',
  };

  test('GIVEN a Spanish course and an English browser WHEN opening the page THEN shows it in Spanish', async () => {
    const certificate = issue(spanishCourse);

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`, {
        'accept-language': 'en-US,en;q=0.9',
      })
    ).text();

    expect(page).toContain('<html lang="es">');
    expect(page).toContain('Certificado válido');
    expect(page).toContain('18 de noviembre de 2026');
  });

  test('GIVEN a Spanish course WHEN the visitor picks English THEN shows English texts with the course date as printed', async () => {
    const certificate = issue(spanishCourse);

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}?lang=en`)
    ).text();

    expect(page).toContain('<html lang="en">');
    expect(page).toContain('Valid certificate');
    expect(page).toContain('18 de noviembre de 2026');
  });

  test('GIVEN a Spanish course WHEN opening the page THEN the switcher links each language and marks Spanish as current', async () => {
    const certificate = issue(spanishCourse);

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`)
    ).text();

    expect(page).toContain(
      '</svg><span class="visually-hidden">Idioma: </span>ES</summary>',
    );
    expect(page).toContain(
      '<a href="?lang=es" hreflang="es" lang="es" aria-current="true">Español<svg',
    );
    expect(page).toContain(
      '<a href="?lang=en" hreflang="en" lang="en">English</a>',
    );
  });

  test('GIVEN a language cookie WHEN opening the page THEN it wins over the course language', async () => {
    const certificate = issue(spanishCourse);

    const page = await (
      await harness.requestPublic(`/c/${certificate.code}`, {
        cookie: `${LocaleCookieName}=en`,
      })
    ).text();

    expect(page).toContain('Valid certificate');
  });
});
