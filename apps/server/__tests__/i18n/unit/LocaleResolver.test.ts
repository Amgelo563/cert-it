import { LocaleEnum } from '@cert-it/shared';
import { describe, expect, test } from 'vite-plus/test';
import { LocaleResolver } from '../../../src/i18n/LocaleResolver';

const resolver = new LocaleResolver({ defaultLocale: LocaleEnum.En });

describe('LocaleResolver (order)', () => {
  test('GIVEN every source WHEN resolving THEN prefers the query', () => {
    const locale = resolver.resolve({
      query: 'es',
      cookie: 'en',
      courseLocale: LocaleEnum.En,
      acceptLanguage: 'en',
    });

    expect(locale).toBe(LocaleEnum.Es);
  });

  test('GIVEN a cookie, course and browser language WHEN resolving THEN prefers the cookie', () => {
    const locale = resolver.resolve({
      cookie: 'es',
      courseLocale: LocaleEnum.En,
      acceptLanguage: 'en',
    });

    expect(locale).toBe(LocaleEnum.Es);
  });

  test('GIVEN a course and browser language WHEN resolving THEN prefers the course', () => {
    const locale = resolver.resolve({
      courseLocale: LocaleEnum.Es,
      acceptLanguage: 'en',
    });

    expect(locale).toBe(LocaleEnum.Es);
  });

  test('GIVEN no source WHEN resolving THEN returns the default locale', () => {
    expect(resolver.resolve({})).toBe(LocaleEnum.En);
  });

  test('GIVEN unsupported query and cookie values WHEN resolving THEN skips them', () => {
    const locale = resolver.resolve({
      query: 'fr',
      cookie: 'ES',
      acceptLanguage: 'es',
    });

    expect(locale).toBe(LocaleEnum.Es);
  });
});

describe('LocaleResolver (Accept-Language)', () => {
  test.each([
    { header: 'es-PE,es;q=0.9,en;q=0.8', expected: LocaleEnum.Es },
    { header: 'fr-FR, fr;q=0.9, es;q=0.5, en;q=0.4', expected: LocaleEnum.Es },
    { header: 'en;q=0.3, es;q=0.7', expected: LocaleEnum.Es },
    { header: 'ES-mx', expected: LocaleEnum.Es },
    { header: 'es;q=0, en;q=0.1', expected: LocaleEnum.En },
  ])(
    'GIVEN "$header" WHEN resolving THEN returns $expected',
    ({ header, expected }) => {
      const esDefault = new LocaleResolver({ defaultLocale: LocaleEnum.Es });

      expect(esDefault.resolve({ acceptLanguage: header })).toBe(expected);
      expect(resolver.resolve({ acceptLanguage: header })).toBe(expected);
    },
  );

  test.each(['fr, de;q=0.9', '*', ''])(
    'GIVEN "%s" without a supported language WHEN resolving THEN returns the default locale',
    (header) => {
      expect(resolver.resolve({ acceptLanguage: header })).toBe(LocaleEnum.En);
    },
  );
});
