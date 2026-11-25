import { describe, expect, test } from 'vite-plus/test';
import { FieldDateOrderEnum } from '../../../src/field/FieldDateOrderEnum';
import {
  detectFieldDateOrder,
  hasAmbiguousDates,
  parseFieldDate,
} from '../../../src/field/parseFieldDate';
import { LocaleEnum } from '../../../src/i18n/LocaleEnum';

const DayFirst = { order: FieldDateOrderEnum.DayFirst };
const MonthFirst = { order: FieldDateOrderEnum.MonthFirst };

describe('parseFieldDate', () => {
  test.each([
    ['2026-11-24', '2026-11-24'],
    ['2026-11-24T10:30:00Z', '2026-11-24'],
    ['2026-1-5', '2026-01-05'],
    ['2026/11/24', '2026-11-24'],
    ['24 Nov 2026', '2026-11-24'],
    ['November 24, 2026', '2026-11-24'],
    ['Nov. 24th, 2026', '2026-11-24'],
    ['24 de noviembre de 2026', '2026-11-24'],
    ['24-sept-26', '2026-09-24'],
    ['1 de Diciembre del 2025', '2025-12-01'],
  ])('GIVEN %s WHEN parsing THEN answers %s', (text, expected) => {
    expect(parseFieldDate(text, DayFirst)).toBe(expected);
  });

  test('GIVEN an ambiguous numeric date WHEN parsing THEN follows the given order', () => {
    expect(parseFieldDate('03/04/2026', DayFirst)).toBe('2026-04-03');
    expect(parseFieldDate('03/04/2026', MonthFirst)).toBe('2026-03-04');
  });

  test('GIVEN a numeric date only one order fits WHEN parsing THEN uses that order', () => {
    expect(parseFieldDate('24/11/2026', MonthFirst)).toBe('2026-11-24');
    expect(parseFieldDate('11/24/2026', DayFirst)).toBe('2026-11-24');
  });

  test('GIVEN two digit years WHEN parsing THEN reads them as dayjs does', () => {
    expect(parseFieldDate('24.11.26', DayFirst)).toBe('2026-11-24');
    expect(parseFieldDate('24.11.85', DayFirst)).toBe('1985-11-24');
  });

  test.each([
    '',
    'soon',
    '31/02/2026',
    '2026-13-01',
    '46350',
    'Nov 2026',
    '24/11-2026',
  ])('GIVEN %j WHEN parsing THEN answers null', (text) => {
    expect(parseFieldDate(text, DayFirst)).toBeNull();
  });

  test('GIVEN the course format WHEN parsing THEN tries it first', () => {
    expect(
      parseFieldDate('2026|24|11', {
        ...DayFirst,
        dateFormat: 'YYYY|DD|MM',
        locale: LocaleEnum.En,
      }),
    ).toBe('2026-11-24');
  });
});

describe('detectFieldDateOrder', () => {
  test('GIVEN a value with a day over 12 WHEN detecting THEN answers day first', () => {
    expect(detectFieldDateOrder(['03/04/2026', '24/11/2026'])).toBe(
      FieldDateOrderEnum.DayFirst,
    );
  });

  test('GIVEN only ambiguous values WHEN detecting THEN answers null', () => {
    expect(detectFieldDateOrder(['03/04/2026', '2026-11-24'])).toBeNull();
  });

  test('GIVEN ambiguous values WHEN checking THEN reports them', () => {
    expect(hasAmbiguousDates(['03/04/2026'])).toBe(true);
    expect(hasAmbiguousDates(['04/04/2026', '24/11/2026'])).toBe(false);
  });
});
