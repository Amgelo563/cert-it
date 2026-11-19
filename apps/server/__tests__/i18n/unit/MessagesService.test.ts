import { LocaleEnum, type Locale } from '@cert-it/shared';
import { describe, expect, test } from 'vite-plus/test';
import { MessagesService } from '../../../src/i18n/MessagesService';

const service = new MessagesService();

const Placeholder = /\{(\w+)\}/g;

/** Returns each text's path with its sorted placeholders, such as `certificate.issuedBy: org`. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    const keys = [...value.matchAll(Placeholder)]
      .map(([, key]) => key ?? '')
      .sort((a, b) => a.localeCompare(b));
    return [`${path}: ${keys.join(',')}`];
  }

  return Object.entries(value as object).flatMap(([key, child]) =>
    shape(child, path ? `${path}.${key}` : key),
  );
}

describe('MessagesService (catalogs)', () => {
  test.each(Object.values(LocaleEnum).filter((l) => l !== LocaleEnum.En))(
    'GIVEN the %s catalog WHEN compared to English THEN has the same texts and placeholders',
    (locale: Locale) => {
      expect(shape(service.get(locale))).toEqual(
        shape(service.get(LocaleEnum.En)),
      );
    },
  );
});

describe('MessagesService (issuedBy)', () => {
  test.each([
    { locale: LocaleEnum.En, expected: 'Issued by Acme' },
    { locale: LocaleEnum.Es, expected: 'Emitido por Acme' },
  ])(
    'GIVEN the $locale locale WHEN getting issuedBy THEN fills in the org',
    ({ locale, expected }) => {
      expect(service.issuedBy(locale, 'Acme')).toBe(expected);
    },
  );

  test('GIVEN an org name that looks like a placeholder WHEN getting issuedBy THEN keeps it as written', () => {
    expect(service.issuedBy(LocaleEnum.En, '{org}')).toBe('Issued by {org}');
  });
});
