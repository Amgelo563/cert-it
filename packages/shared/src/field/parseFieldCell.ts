import {
  type CourseFieldType,
  CourseFieldTypeEnum,
} from './CourseFieldTypeEnum';
import type { FieldDateOrder } from './FieldDateOrderEnum';
import {
  type FieldValue,
  isImageFileName,
  MaxFieldTextLength,
} from './FieldValue';
import {
  type FieldValueError,
  FieldValueErrorEnum,
} from './FieldValueErrorEnum';
import { parseFieldDate } from './parseFieldDate';
import type { Locale } from '../i18n/LocaleEnum';

/** A cell read as a field's value: the value, nothing for an empty cell, or why it can't be read. */
export type ParsedFieldCell =
  | { readonly value: FieldValue }
  | { readonly empty: true }
  | { readonly error: FieldValueError };

type ParseFieldCellOptions = {
  /** How numeric dates are read. */
  dateOrder: FieldDateOrder;
  /** The course's date format and language, also tried for dates. */
  dateFormat?: string;
  locale?: Locale;
};

// compared without case or accents
const TrueWords = new Set(['true', 'yes', 'y', 'si', 's', '1', 'x', '\u2713']);
const FalseWords = new Set(['false', 'no', 'n', '0']);

const Decimal = /^[+-]?\d+(?:[.,]\d+)?$/;

/**
 * Reads a CSV cell as the value of a field of the given type.
 *
 * Numbers take . or , as the decimal separator, without thousands separators. Images are their stored file name, which the browser puts in place of the file's own name.
 */
export function parseFieldCell(
  type: CourseFieldType,
  cell: string,
  options: ParseFieldCellOptions,
): ParsedFieldCell {
  const text = cell.trim();
  if (text === '') return { empty: true };

  switch (type) {
    case CourseFieldTypeEnum.Text:
      return text.length > MaxFieldTextLength
        ? { error: FieldValueErrorEnum.TooLong }
        : { value: text };
    case CourseFieldTypeEnum.Number:
      return parseNumber(text);
    case CourseFieldTypeEnum.Date: {
      const date = parseFieldDate(text, {
        order: options.dateOrder,
        dateFormat: options.dateFormat,
        locale: options.locale,
      });
      return date === null
        ? { error: FieldValueErrorEnum.InvalidDate }
        : { value: date };
    }
    case CourseFieldTypeEnum.Boolean:
      return parseBoolean(text);
    case CourseFieldTypeEnum.Image:
      return isImageFileName(text)
        ? { value: text }
        : { error: FieldValueErrorEnum.ImageNotFound };
  }
}

function parseNumber(text: string): ParsedFieldCell {
  if (!Decimal.test(text)) return { error: FieldValueErrorEnum.InvalidNumber };
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value)
    ? { value }
    : { error: FieldValueErrorEnum.InvalidNumber };
}

function parseBoolean(text: string): ParsedFieldCell {
  const word = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (TrueWords.has(word)) return { value: true };
  if (FalseWords.has(word)) return { value: false };
  return { error: FieldValueErrorEnum.InvalidBoolean };
}
