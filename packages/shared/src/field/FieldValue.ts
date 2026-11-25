import {
  type CourseFieldType,
  CourseFieldTypeEnum,
} from './CourseFieldTypeEnum';

/**
 * A participant's value for one course field.
 *
 * Text is a string, numbers a number, dates a YYYY-MM-DD string, booleans a boolean, and images the stored file's name, <sha256>.<png|jpg>.
 */
export type FieldValue = string | number | boolean;

/** A participant's values, by course field ID. Fields without a value are left out. */
export type FieldValues = Readonly<Record<string, FieldValue>>;

/** Longest text a text field takes. */
export const MaxFieldTextLength = 1000;

const ImageFileName = /^[0-9a-f]{64}\.(png|jpg)$/;

const IsoDate = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns whether the text is a stored image's file name, <sha256>.<png|jpg>. */
export function isImageFileName(value: string): boolean {
  return ImageFileName.test(value);
}

/** Returns whether the text is a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  const match = IsoDate.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

/** Returns whether a value has the shape a field of the given type stores. */
export function isFieldValueOf(type: CourseFieldType, value: unknown): boolean {
  switch (type) {
    case CourseFieldTypeEnum.Text:
      return (
        typeof value === 'string'
        && value.trim() !== ''
        && value.length <= MaxFieldTextLength
      );
    case CourseFieldTypeEnum.Number:
      return typeof value === 'number' && Number.isFinite(value);
    case CourseFieldTypeEnum.Date:
      return typeof value === 'string' && isIsoDate(value);
    case CourseFieldTypeEnum.Boolean:
      return typeof value === 'boolean';
    case CourseFieldTypeEnum.Image:
      return typeof value === 'string' && isImageFileName(value);
  }
}
