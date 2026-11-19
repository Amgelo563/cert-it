import type { Brand, Locale } from '@cert-it/shared';

export type CourseId = Brand<number, 'CourseId'>;

/** A course or event whose participants receive certificates. */
export type Course = {
  readonly id: CourseId;
  readonly name: string;
  /** Language of the course's certificates and public pages. */
  readonly locale: Locale;
  /** Format of the dates printed on the course's certificates. */
  readonly dateFormat: string;
  /** Whether the course is listed in the public certificate lookup. */
  readonly lookupEnabled: boolean;
  /** Whether the course hasn't been archived. */
  readonly active: boolean;
  readonly createdAt: Date;
};
