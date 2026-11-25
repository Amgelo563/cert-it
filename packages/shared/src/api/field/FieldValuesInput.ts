import {
  boolean,
  null as zNull,
  number,
  type output,
  record,
  string,
  union,
} from 'zod';
import { MaxFieldTextLength } from '../../field/FieldValue';
import { MaxCourseFields } from './CourseFieldFields';

/** Values given for course fields by field ID, null to clear one; each is checked against its field's type. */
export const FieldValuesInputSchema = record(
  string().regex(/^\d+$/),
  union([string().max(MaxFieldTextLength), number(), boolean(), zNull()]),
).refine((values) => Object.keys(values).length <= MaxCourseFields, {
  message: 'Too many fields',
});

/** Values given for course fields by field ID, null to clear one. */
export type FieldValuesInput = output<typeof FieldValuesInputSchema>;
