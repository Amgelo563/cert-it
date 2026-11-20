import { boolean, type output, strictObject } from 'zod';
import { CourseFields } from './CourseFields';

export const UpdateCourseRequestSchema = strictObject({
  name: CourseFields.name.optional(),
  locale: CourseFields.locale.optional(),
  dateFormat: CourseFields.dateFormat.optional(),
  lookupEnabled: boolean().optional(),
  active: boolean().optional(),
}).refine((body) => Object.values(body).some((value) => value !== undefined), {
  message: 'Nothing to update',
});

/** The body of a request to change a course's fields. */
export type UpdateCourseRequest = output<typeof UpdateCourseRequestSchema>;
