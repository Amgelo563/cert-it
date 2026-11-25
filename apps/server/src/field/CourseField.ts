import type { Brand, CourseFieldType, FieldValues } from '@cert-it/shared';
import type { CourseId } from '../course/Course';

export type CourseFieldId = Brand<number, 'CourseFieldId'>;

/** A value a course keeps for each of its participants, such as a group or a grade. */
export type CourseField = {
  readonly id: CourseFieldId;
  readonly courseId: CourseId;
  /** Shown in the panel; unique in the course by its {@link CourseField.labelKey}. */
  readonly label: string;
  /** The label without case or accents, as labels are compared. */
  readonly labelKey: string;
  readonly type: CourseFieldType;
  /** Whether every participant needs a value before getting a certificate. */
  readonly required: boolean;
  /** Place in the course's order of fields, starting at 0. */
  readonly position: number;
  readonly createdAt: Date;
};

/** Returns the required fields a participant's values leave without a value. */
export function listMissingRequired(
  fields: readonly CourseField[],
  values: FieldValues,
): CourseField[] {
  return fields.filter(
    (field) => field.required && values[String(field.id)] === undefined,
  );
}
