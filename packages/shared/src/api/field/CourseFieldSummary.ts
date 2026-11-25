import type { CourseFieldType } from '../../field/CourseFieldTypeEnum';

/** A field of a course, as the field routes return it. */
export type CourseFieldSummary = {
  readonly id: number;
  readonly courseId: number;
  /** Unique in the course, compared without case or accents. */
  readonly label: string;
  readonly type: CourseFieldType;
  /** Whether every participant needs a value before getting a certificate. */
  readonly required: boolean;
  /** Place in the course's order of fields, starting at 0. */
  readonly position: number;
  /** Number of participants with a value; the type can only change while it's 0. */
  readonly valueCount: number;
};
