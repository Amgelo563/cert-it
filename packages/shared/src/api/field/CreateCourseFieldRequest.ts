import { type output, strictObject } from 'zod';
import { CourseFieldFields } from './CourseFieldFields';

export const CreateCourseFieldRequestSchema = strictObject({
  label: CourseFieldFields.label,
  type: CourseFieldFields.type,
  required: CourseFieldFields.required.default(false),
});

/** The body of a request to add a field to a course, placed after its other fields. */
export type CreateCourseFieldRequest = output<
  typeof CreateCourseFieldRequestSchema
>;
