import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { LocaleEnum, type Locale } from './LocaleEnum';

type CourseDateFormatterOptions = {
  /** Language of the month and weekday names. */
  locale: Locale;
  /** dayjs format string, such as `MMMM D, YYYY`. */
  dateFormat: string;
};

/** Formats dates with a course's locale and date format. */
export class CourseDateFormatter {
  /** Date format given to new courses, per locale. */
  public static readonly DefaultFormats: Record<Locale, string> = {
    [LocaleEnum.En]: 'MMMM D, YYYY',
    [LocaleEnum.Es]: 'D [de] MMMM [de] YYYY',
  };

  protected readonly locale: Locale;

  protected readonly dateFormat: string;

  constructor(options: CourseDateFormatterOptions) {
    this.locale = options.locale;
    this.dateFormat = options.dateFormat;
  }

  /** Formats a `YYYY-MM-DD` date, without shifting it to any timezone. */
  public format(date: string): string {
    // dayjs parses date-only strings as local midnight, so the day never moves
    return dayjs(date).locale(this.locale).format(this.dateFormat);
  }
}
