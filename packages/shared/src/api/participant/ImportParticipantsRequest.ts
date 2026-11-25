import {
  array,
  boolean,
  enum as zEnum,
  object,
  type output,
  record,
  strictObject,
  string,
} from 'zod';
import { FieldValueErrorEnum } from '../../field/FieldValueErrorEnum';
import { MaxFieldTextLength } from '../../field/FieldValue';
import { MaxCourseFields } from '../field/CourseFieldFields';

/** What the browser can find wrong with an image cell before sending it. */
export const ImportFileErrors = [
  FieldValueErrorEnum.ImageNotFound,
  FieldValueErrorEnum.ImageAmbiguous,
  FieldValueErrorEnum.ImageInvalid,
  FieldValueErrorEnum.ImageTooLarge,
] as const;

/** What an import does with a row whose email the course already has. */
export const ImportModeEnum = {
  /** Keep the existing participant as it is. */
  Skip: 'skip',
  /** Replace the existing participant's name and the field values the row has. */
  Update: 'update',
} as const;

/** What an import does with a row whose email the course already has. */
export type ImportMode = (typeof ImportModeEnum)[keyof typeof ImportModeEnum];

/** Most rows one import takes. */
export const MaxImportRows = 5000;

// loose, since each row is checked on its own and reported back
const ImportRowSchema = object({
  name: string().max(1000),
  email: string().max(1000),
  /** Cells of the columns mapped to course fields, by field ID; images as their stored file name. */
  fields: record(string().regex(/^\d+$/), string().max(MaxFieldTextLength * 5))
    .refine((fields) => Object.keys(fields).length <= MaxCourseFields, {
      message: 'Too many fields',
    })
    .optional(),
  /** Image cells the browser couldn't match to a file, by field ID. */
  fileErrors: record(
    string().regex(/^\d+$/),
    zEnum(ImportFileErrors),
  ).optional(),
});

export const ImportParticipantsRequestSchema = strictObject({
  mode: zEnum(ImportModeEnum),
  /** Checks every row and reports what would happen, without saving anything. */
  dryRun: boolean(),
  rows: array(ImportRowSchema).min(1).max(MaxImportRows),
});

/** One row of a participant import, as mapped from the CSV in the browser. */
export type ImportRow = output<typeof ImportRowSchema>;

/** The body of a request to import participants into a course. */
export type ImportParticipantsRequest = output<
  typeof ImportParticipantsRequestSchema
>;
