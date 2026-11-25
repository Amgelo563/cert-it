export const CourseFieldTypeEnum = {
  Text: 'text',
  Number: 'number',
  Date: 'date',
  Boolean: 'boolean',
  Image: 'image',
} as const;

/** What kind of value a course field holds for each participant. */
export type CourseFieldType =
  (typeof CourseFieldTypeEnum)[keyof typeof CourseFieldTypeEnum];
