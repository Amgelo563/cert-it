import { describe, expect, test } from 'vite-plus/test';
import { SiteUrl } from '../../../../src/http/url/SiteUrl';

describe('SiteUrl (root)', () => {
  const siteUrl = new SiteUrl({ baseUrl: 'https://certs.example.org' });

  test('GIVEN a root base URL WHEN getting the base path THEN returns a slash', () => {
    expect(siteUrl.getBasePath()).toBe('/');
  });

  test('GIVEN a root base URL WHEN building paths and URLs THEN adds no prefix', () => {
    expect(siteUrl.path('/c/ABC')).toBe('/c/ABC');
    expect(siteUrl.url('/c/ABC')).toBe('https://certs.example.org/c/ABC');
  });
});

describe('SiteUrl (path)', () => {
  test.each([
    'https://example.org/certificados',
    'https://example.org/certificados/',
  ])(
    'GIVEN %s WHEN building paths and URLs THEN prefixes the base path once',
    (baseUrl) => {
      const siteUrl = new SiteUrl({ baseUrl });

      expect(siteUrl.getBasePath()).toBe('/certificados');
      expect(siteUrl.path('/c/ABC')).toBe('/certificados/c/ABC');
      expect(siteUrl.url('/c/ABC')).toBe(
        'https://example.org/certificados/c/ABC',
      );
    },
  );

  test('GIVEN a base URL with a path WHEN getting the origin THEN leaves the path out', () => {
    const siteUrl = new SiteUrl({
      baseUrl: 'https://example.org/certificados',
    });

    expect(siteUrl.getOrigin()).toBe('https://example.org');
  });
});

describe('SiteUrl (isSecure)', () => {
  test.each([
    ['https://certs.example.org', true],
    ['http://localhost:3000', false],
  ])('GIVEN %s WHEN checking THEN returns %s', (baseUrl, secure) => {
    expect(new SiteUrl({ baseUrl }).isSecure()).toBe(secure);
  });
});
