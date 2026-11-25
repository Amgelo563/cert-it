import { type Locale, LocaleEnum } from '../i18n/LocaleEnum';

/** How a numeric date like 03/04/2026 is read: day first, or month first. */
export const FieldDateOrderEnum = {
  DayFirst: 'day_first',
  MonthFirst: 'month_first',
} as const;

/** How a numeric date like 03/04/2026 is read. */
export type FieldDateOrder =
  (typeof FieldDateOrderEnum)[keyof typeof FieldDateOrderEnum];

/** Returns the order a course's language writes numeric dates in. */
export function dateOrderOf(locale: Locale): FieldDateOrder {
  return locale === LocaleEnum.En
    ? FieldDateOrderEnum.MonthFirst
    : FieldDateOrderEnum.DayFirst;
}
