type CronScheduleOptions = {
  minutes: ReadonlySet<number>;
  hours: ReadonlySet<number>;
  daysOfMonth: ReadonlySet<number>;
  months: ReadonlySet<number>;
  daysOfWeek: ReadonlySet<number>;
  /** Whether both day fields are restricted, so a day matches either of them, as in cron. */
  eitherDay: boolean;
};

type CronField = {
  min: number;
  max: number;
  names?: readonly string[];
};

/** A 5-field cron expression (minute, hour, day of month, month, day of week), matched against local time. */
export class CronSchedule {
  protected static readonly Fields = {
    minute: { min: 0, max: 59 },
    hour: { min: 0, max: 23 },
    dayOfMonth: { min: 1, max: 31 },
    month: {
      min: 1,
      max: 12,
      // index 0 is unused, so a name's index is its number
      names: [
        '',
        'jan',
        'feb',
        'mar',
        'apr',
        'may',
        'jun',
        'jul',
        'aug',
        'sep',
        'oct',
        'nov',
        'dec',
      ],
    },
    // 7 is also Sunday
    dayOfWeek: {
      min: 0,
      max: 7,
      names: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    },
  } as const satisfies Record<string, CronField>;

  protected readonly minutes: ReadonlySet<number>;

  protected readonly hours: ReadonlySet<number>;

  protected readonly daysOfMonth: ReadonlySet<number>;

  protected readonly months: ReadonlySet<number>;

  protected readonly daysOfWeek: ReadonlySet<number>;

  protected readonly eitherDay: boolean;

  constructor(options: CronScheduleOptions) {
    this.minutes = options.minutes;
    this.hours = options.hours;
    this.daysOfMonth = options.daysOfMonth;
    this.months = options.months;
    this.daysOfWeek = options.daysOfWeek;
    this.eitherDay = options.eitherDay;
  }

  /** Parses an expression, returning null if it is not valid. */
  public static parse(expression: string): CronSchedule | null {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [
      string,
      string,
      string,
      string,
      string,
    ];
    const { Fields } = CronSchedule;
    const minutes = CronSchedule.parseField(minute, Fields.minute);
    const hours = CronSchedule.parseField(hour, Fields.hour);
    const daysOfMonth = CronSchedule.parseField(dayOfMonth, Fields.dayOfMonth);
    const months = CronSchedule.parseField(month, Fields.month);
    const daysOfWeek = CronSchedule.parseField(dayOfWeek, Fields.dayOfWeek);
    if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) {
      return null;
    }

    if (daysOfWeek.has(7)) daysOfWeek.add(0);

    return new CronSchedule({
      minutes,
      hours,
      daysOfMonth,
      months,
      daysOfWeek,
      eitherDay: !dayOfMonth.startsWith('*') && !dayOfWeek.startsWith('*'),
    });
  }

  /** Returns whether the schedule runs in the minute of the given date. */
  public matches(date: Date): boolean {
    if (
      !this.minutes.has(date.getMinutes())
      || !this.hours.has(date.getHours())
      || !this.months.has(date.getMonth() + 1)
    ) {
      return false;
    }

    const dayOfMonth = this.daysOfMonth.has(date.getDate());
    const dayOfWeek = this.daysOfWeek.has(date.getDay());

    return this.eitherDay ? dayOfMonth || dayOfWeek : dayOfMonth && dayOfWeek;
  }

  // a comma list of *, n, a-b or names, each with an optional /step
  protected static parseField(
    text: string,
    field: CronField,
  ): Set<number> | null {
    const values = new Set<number>();

    for (const part of text.toLowerCase().split(',')) {
      const [range = '', stepText, extra] = part.split('/');
      if (extra !== undefined) return null;

      const step =
        stepText === undefined ? 1 : CronSchedule.parseNumber(stepText);
      if (step === null || step < 1) return null;

      let low: number | null;
      let high: number | null;
      if (range === '*') {
        low = field.min;
        high = field.max;
      } else if (range.includes('-')) {
        const [from = '', to = ''] = range.split('-', 2);
        low = CronSchedule.parseValue(from, field);
        high = CronSchedule.parseValue(to, field);
      } else {
        low = CronSchedule.parseValue(range, field);
        // n/step runs from n to the end, as in cron
        high = stepText === undefined ? low : field.max;
      }

      if (low === null || high === null || low > high) return null;
      for (let value = low; value <= high; value += step) values.add(value);
    }

    return values;
  }

  protected static parseValue(text: string, field: CronField): number | null {
    const named = text === '' ? -1 : (field.names?.indexOf(text) ?? -1);
    const value = named >= 0 ? named : CronSchedule.parseNumber(text);
    if (value === null || value < field.min || value > field.max) return null;

    return value;
  }

  protected static parseNumber(text: string): number | null {
    return /^\d+$/.test(text) ? Number(text) : null;
  }
}
