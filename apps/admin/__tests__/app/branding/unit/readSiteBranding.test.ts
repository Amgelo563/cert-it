import { describe, expect, test } from 'vite-plus/test';
import {
  DefaultBranding,
  readSiteBranding,
} from '../../../../src/app/branding/readSiteBranding';

// only what readSiteBranding reads: the meta tag's content
function documentWith(content: string | null): Document {
  return {
    querySelector: () =>
      content === null ? null : { getAttribute: () => content },
  } as unknown as Document;
}

const Shades = Array.from({ length: 10 }, (_, i) => `#00000${i}`);

describe('readSiteBranding', () => {
  test('GIVEN no meta tag WHEN reading THEN returns the built-in branding', () => {
    expect(readSiteBranding(documentWith(null))).toBe(DefaultBranding);
  });

  test('GIVEN the server branding WHEN reading THEN returns it', () => {
    const branding = {
      name: 'Acme',
      brandShades: Shades,
      logo: '/branding/abc.png',
      logoDark: null,
      fontFamily: "'cert-it brand', sans-serif",
    };

    expect(readSiteBranding(documentWith(JSON.stringify(branding)))).toEqual(
      branding,
    );
  });

  test('GIVEN wrong shades and a missing name WHEN reading THEN falls back for those values', () => {
    const branding = readSiteBranding(
      documentWith(JSON.stringify({ brandShades: ['#fff'], logo: 5 })),
    );

    expect(branding.name).toBe(DefaultBranding.name);
    expect(branding.brandShades).toBe(DefaultBranding.brandShades);
    expect(branding.logo).toBeNull();
  });

  test('GIVEN content that is not JSON WHEN reading THEN returns the built-in branding', () => {
    expect(readSiteBranding(documentWith('{oops'))).toBe(DefaultBranding);
  });
});
