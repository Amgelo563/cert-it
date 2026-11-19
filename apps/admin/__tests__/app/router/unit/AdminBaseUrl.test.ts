import { describe, expect, test } from 'vite-plus/test';
import { AdminBaseUrl } from '../../../../src/app/router/AdminBaseUrl';

function basename(baseUri: string): string {
  return AdminBaseUrl.create({ injections: { baseUri } }).getRouterBasename();
}

describe('AdminBaseUrl', () => {
  test.each([
    ['https://certs.example.org/admin/', '/admin'],
    ['https://example.org/certs/admin/', '/certs/admin'],
    ['http://localhost:5173/admin/', '/admin'],
  ])(
    'GIVEN the base %s WHEN reading the router basename THEN returns %s',
    (baseUri, expected) => {
      expect(basename(baseUri)).toBe(expected);
    },
  );

  test('GIVEN a base at the root WHEN reading the router basename THEN returns a slash', () => {
    expect(basename('https://certs.example.org/')).toBe('/');
  });
});
