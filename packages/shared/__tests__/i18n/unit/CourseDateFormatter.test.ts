import { describe, expect, test } from 'vite-plus/test';
import { CourseDateFormatter } from '../../../src/i18n/CourseDateFormatter';
import { LocaleEnum } from '../../../src/i18n/LocaleEnum';

describe('CourseDateFormatter (format)', () => {
  test('GIVEN the English default format WHEN formatting THEN uses English month names', () => {
    const formatter = new CourseDateFormatter({
      locale: LocaleEnum.En,
      dateFormat: CourseDateFormatter.DefaultFormats[LocaleEnum.En],
    });

    expect(formatter.format('2026-11-19')).toBe('November 19, 2026');
  });

  test('GIVEN the Spanish default format WHEN formatting THEN uses Spanish month names and escaped text', () => {
    const formatter = new CourseDateFormatter({
      locale: LocaleEnum.Es,
      dateFormat: CourseDateFormatter.DefaultFormats[LocaleEnum.Es],
    });

    expect(formatter.format('2026-11-19')).toBe('19 de noviembre de 2026');
  });

  test('GIVEN two formatters with different locales WHEN formatting THEN neither changes the other', () => {
    const es = new CourseDateFormatter({
      locale: LocaleEnum.Es,
      dateFormat: 'MMMM',
    });
    const en = new CourseDateFormatter({
      locale: LocaleEnum.En,
      dateFormat: 'MMMM',
    });

    expect(es.format('2026-01-01')).toBe('enero');
    expect(en.format('2026-01-01')).toBe('January');
  });

  test.each(['2026-01-01', '2026-12-31'])(
    'GIVEN the edge-of-year date %s WHEN formatting THEN keeps the same day',
    (date) => {
      const formatter = new CourseDateFormatter({
        locale: LocaleEnum.En,
        dateFormat: 'YYYY-MM-DD',
      });

      expect(formatter.format(date)).toBe(date);
    },
  );
});
