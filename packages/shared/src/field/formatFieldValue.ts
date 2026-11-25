import { CourseDateFormatter } from '../i18n/CourseDateFormatter';
import type { Locale } from '../i18n/LocaleEnum';
import {
  type CourseFieldType,
  CourseFieldTypeEnum,
} from './CourseFieldTypeEnum';
import type { FieldValue } from './FieldValue';

type FormatFieldValueOptions = {
  locale: Locale;
  /** The course's dayjs date format. */
  dateFormat: string;
};

/**
 * Returns a text, number or date value as a certificate prints it, in the course's language and date format.
 *
 * @returns Null for booleans and images, which print by other means, and for values of the wrong kind.
 */
export function formatFieldValue(
  type: CourseFieldType,
  value: FieldValue,
  options: FormatFieldValueOptions,
): string | null {
  switch (type) {
    case CourseFieldTypeEnum.Text:
      return typeof value === 'string' ? value : null;
    case CourseFieldTypeEnum.Number:
      // grouping left out, so a value prints as it was entered
      return typeof value === 'number'
        ? new Intl.NumberFormat(options.locale, {
            maximumFractionDigits: 10,
            useGrouping: false,
          }).format(value)
        : null;
    case CourseFieldTypeEnum.Date:
      return typeof value === 'string'
        ? new CourseDateFormatter(options).format(value)
        : null;
    case CourseFieldTypeEnum.Boolean:
    case CourseFieldTypeEnum.Image:
      return null;
  }
}
