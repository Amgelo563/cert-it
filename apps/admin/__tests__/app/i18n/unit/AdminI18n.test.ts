import { LocaleEnum } from '@cert-it/shared';
import dayjs from 'dayjs';
import { createInstance } from 'i18next';
import { describe, expect, test } from 'vite-plus/test';
import { AdminI18n } from '../../../../src/app/i18n/AdminI18n';
import { EnAdminMessages } from '../../../../src/app/i18n/messages/EnAdminMessages';
import { EsAdminMessages } from '../../../../src/app/i18n/messages/EsAdminMessages';
import { StubDocument } from '../mocks/StubDocument';

const Placeholder = /\{(\w+)\}/g;

async function start(
  document: StubDocument,
  browserLanguages: string[] = [],
): Promise<AdminI18n> {
  const i18n = AdminI18n.create({
    injections: {
      instance: createInstance(),
      document: document.asDocument(),
      browserLanguages,
    },
  });
  await i18n.start();
  return i18n;
}

/** Returns each text's path with its sorted placeholders, such as `app.title: `. */
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

describe('AdminI18n (catalogs)', () => {
  test('GIVEN the Spanish catalog WHEN compared to English THEN has the same texts and placeholders', () => {
    expect(shape(EsAdminMessages)).toEqual(shape(EnAdminMessages));
  });
});

describe('AdminI18n (detection)', () => {
  test('GIVEN a saved cookie WHEN starting THEN prefers it over the browser and default', async () => {
    const document = new StubDocument({
      cookie: 'other=1; lang=es',
      defaultLocale: 'en',
    });

    const i18n = await start(document, ['en-US']);

    expect(i18n.getLocale()).toBe(LocaleEnum.Es);
  });

  test('GIVEN only browser languages WHEN starting THEN takes the first supported one', async () => {
    const i18n = await start(new StubDocument(), ['fr-FR', 'es-PE', 'en']);

    expect(i18n.getLocale()).toBe(LocaleEnum.Es);
  });

  test('GIVEN no cookie or supported browser language WHEN starting THEN uses the site default', async () => {
    const document = new StubDocument({ defaultLocale: 'es' });

    const i18n = await start(document, ['fr']);

    expect(i18n.getLocale()).toBe(LocaleEnum.Es);
  });

  test('GIVEN nothing WHEN starting THEN falls back to English', async () => {
    const i18n = await start(new StubDocument());

    expect(i18n.getLocale()).toBe(LocaleEnum.En);
  });
});

describe('AdminI18n (changes)', () => {
  test('GIVEN a detected language WHEN starting THEN sets the page language without saving a cookie', async () => {
    const document = new StubDocument();

    await start(document, ['es']);

    expect(document.documentElement.lang).toBe('es');
    expect(document.cookie).toBe('');
  });

  test.each([
    { pathname: '/admin/courses', path: '/' },
    { pathname: '/certs/admin/', path: '/certs' },
    { pathname: '/certs/admin', path: '/certs' },
  ])(
    'GIVEN the admin at $pathname WHEN changing the language THEN saves it under $path',
    async ({ pathname, path }) => {
      const document = new StubDocument({ pathname });
      const i18n = await start(document, ['en']);

      await i18n.getInstance().changeLanguage(LocaleEnum.Es);

      expect(document.cookie).toBe(
        `lang=es; Path=${path}; Max-Age=31536000; SameSite=Lax; Secure`,
      );
      expect(document.documentElement.lang).toBe('es');
      expect(dayjs.locale()).toBe('es');
    },
  );

  test('GIVEN plain HTTP WHEN changing the language THEN saves the cookie without Secure', async () => {
    const document = new StubDocument({ protocol: 'http:' });
    const i18n = await start(document, ['en']);

    await i18n.getInstance().changeLanguage(LocaleEnum.Es);

    expect(document.cookie).not.toContain('Secure');
  });
});

describe('AdminI18n (texts)', () => {
  test('GIVEN the current language WHEN translating THEN returns its text', async () => {
    const i18n = await start(new StubDocument(), ['es']);

    expect(i18n.getInstance().t('language.name')).toBe('Español');
  });
});
