import { array, int, type output, strictObject } from 'zod';
import { MaxCourseFields } from './CourseFieldFields';

export const ReorderCourseFieldsRequestSchema = strictObject({
  /** Every field of the course, in their new order. */
  ids: array(int().positive()).max(MaxCourseFields),
});

/** The body of a request to change the order of a course's fields. */
export type ReorderCourseFieldsRequest = output<
  typeof ReorderCourseFieldsRequestSchema
>;
