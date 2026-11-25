import { type output, strictObject } from 'zod';
import { CourseFieldFields } from './CourseFieldFields';

export const UpdateCourseFieldRequestSchema = strictObject({
  label: CourseFieldFields.label.optional(),
  /** Only while no participant has a value. */
  type: CourseFieldFields.type.optional(),
  required: CourseFieldFields.required.optional(),
}).refine(
  (body) =>
    body.label !== undefined
    || body.type !== undefined
    || body.required !== undefined,
  { message: 'Nothing to update' },
);

/** The body of a request to change a course field. */
export type UpdateCourseFieldRequest = output<
  typeof UpdateCourseFieldRequestSchema
>;
