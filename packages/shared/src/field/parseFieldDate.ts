import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/es';
import type { Locale } from '../i18n/LocaleEnum';
import { type FieldDateOrder, FieldDateOrderEnum } from './FieldDateOrderEnum';
import { isIsoDate } from './FieldValue';

dayjs.extend(customParseFormat);

type ParseFieldDateOptions = {
  /** How numeric dates whose order isn't obvious are read. */
  order: FieldDateOrder;
  /** The course's own dayjs format, tried first. */
  dateFormat?: string;
  /** Language of the course's format. */
  locale?: Locale;
};

// month names in English and Spanish, without accents or dots
const Months: Readonly<Record<string, number>> = {
  january: 1,
  jan: 1,
  enero: 1,
  ene: 1,
  february: 2,
  feb: 2,
  febrero: 2,
  march: 3,
  mar: 3,
  marzo: 3,
  april: 4,
  apr: 4,
  abril: 4,
  abr: 4,
  may: 5,
  mayo: 5,
  june: 6,
  jun: 6,
  junio: 6,
  july: 7,
  jul: 7,
  julio: 7,
  august: 8,
  aug: 8,
  agosto: 8,
  ago: 8,
  september: 9,
  sep: 9,
  sept: 9,
  septiembre: 9,
  setiembre: 9,
  set: 9,
  october: 10,
  oct: 10,
  octubre: 10,
  november: 11,
  nov: 11,
  noviembre: 11,
  december: 12,
  dec: 12,
  diciembre: 12,
  dic: 12,
};

// words between the parts of a written date
const FillerWords = new Set(['de', 'del', 'of', 'the']);

const IsoDateTime =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i;

const YearFirst = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/;

const Numeric = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{2}|\d{4})$/;

/**
 * Reads a date as people write it, or returns null if it isn't one.
 *
 * Takes ISO dates, with or without a time, numeric dates with /, - or ., and dates with English or Spanish month names. Numeric dates are read in the given order unless only one order makes sense.
 *
 * @returns The date as YYYY-MM-DD.
 */
export function parseFieldDate(
  text: string,
  options: ParseFieldDateOptions,
): string | null {
  const value = text.trim();
  if (value === '') return null;

  if (options.dateFormat) {
    const parsed = dayjs(
      value,
      options.dateFormat,
      options.locale ?? 'en',
      true,
    );
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
  }

  const iso = IsoDateTime.exec(value);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const yearFirst = YearFirst.exec(value);
  if (yearFirst) {
    return toIso(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
    );
  }

  const numeric = Numeric.exec(value);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[3]);
    const year = fullYear(numeric[4] ?? '');
    const dayFirst = orderOf(first, second) ?? options.order;
    return dayFirst === FieldDateOrderEnum.DayFirst
      ? toIso(year, second, first)
      : toIso(year, first, second);
  }

  return parseWritten(value);
}

/**
 * Returns the order numeric dates of a column must be in, if one of its values shows it, such as 24/11/2026.
 *
 * @returns Null when no value shows the order, or values disagree as much one way as the other.
 */
export function detectFieldDateOrder(
  values: readonly string[],
): FieldDateOrder | null {
  let dayFirst = 0;
  let monthFirst = 0;
  for (const text of values) {
    const numeric = Numeric.exec(text.trim());
    if (!numeric) continue;
    const order = orderOf(Number(numeric[1]), Number(numeric[3]));
    if (order === FieldDateOrderEnum.DayFirst) dayFirst += 1;
    if (order === FieldDateOrderEnum.MonthFirst) monthFirst += 1;
  }
  if (dayFirst === monthFirst) return null;
  return dayFirst > monthFirst
    ? FieldDateOrderEnum.DayFirst
    : FieldDateOrderEnum.MonthFirst;
}

/** Returns whether a column has numeric dates whose order matters, such as 03/04/2026. */
export function hasAmbiguousDates(values: readonly string[]): boolean {
  return values.some((text) => {
    const numeric = Numeric.exec(text.trim());
    return (
      numeric !== null
      && Number(numeric[1]) !== Number(numeric[3])
      && orderOf(Number(numeric[1]), Number(numeric[3])) === null
    );
  });
}

// only one order works when a part is over 12
function orderOf(first: number, second: number): FieldDateOrder | null {
  if (first > 12 && second <= 12) return FieldDateOrderEnum.DayFirst;
  if (second > 12 && first <= 12) return FieldDateOrderEnum.MonthFirst;
  return null;
}

// such as 24 Nov 2026, November 24, 2026 or 24 de noviembre de 2026
function parseWritten(value: string): string | null {
  const words = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[.,/-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word !== '' && !FillerWords.has(word))
    // ordinals such as 24th or 1st
    .map((word) => word.replace(/^(\d{1,2})(st|nd|rd|th|ro|do|er|o)$/, '$1'));
  if (words.length !== 3) return null;

  const monthIndex = words.findIndex((word) => Months[word] !== undefined);
  if (monthIndex === -1 || monthIndex === 2) return null;
  const month = Months[words[monthIndex] ?? ''] ?? 0;
  const [first, second] = words.filter((_, index) => index !== monthIndex);
  if (!first || !second || !/^\d+$/.test(first) || !/^\d+$/.test(second)) {
    return null;
  }

  // a four digit number before the day is the year, as in 2026 Nov 24
  if (monthIndex === 1 && first.length === 4) {
    return toIso(Number(first), month, Number(second));
  }
  if (second.length !== 2 && second.length !== 4) return null;
  return toIso(fullYear(second), month, Number(first));
}

// two digit years as dayjs reads them: 00 to 68 are 2000s
function fullYear(text: string): number {
  const year = Number(text);
  if (text.length !== 2) return year;
  return year <= 68 ? 2000 + year : 1900 + year;
}

function toIso(year: number, month: number, day: number): string | null {
  const pad = (part: number) => String(part).padStart(2, '0');
  const iso = `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  return isIsoDate(iso) ? iso : null;
}
