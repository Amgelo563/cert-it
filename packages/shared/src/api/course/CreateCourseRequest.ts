import { boolean, type output, strictObject } from 'zod';
import { CourseFields } from './CourseFields';

export const CreateCourseRequestSchema = strictObject({
  name: CourseFields.name,
  /** Defaults to the site's default locale. */
  locale: CourseFields.locale.optional(),
  /** Defaults to the locale's default format. */
  dateFormat: CourseFields.dateFormat.optional(),
  lookupEnabled: boolean().optional(),
});

/** The body of a request to create a course. */
export type CreateCourseRequest = output<typeof CreateCourseRequestSchema>;
