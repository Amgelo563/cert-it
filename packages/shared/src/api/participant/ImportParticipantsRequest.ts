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

/** What an import does with a row whose email the course already has. */
export const ImportModeEnum = {
  /** Keep the existing participant as it is. */
  Skip: 'skip',
  /** Replace the existing participant's name and merge in its extra columns. */
  Update: 'update',
} as const;

/** What an import does with a row whose email the course already has. */
export type ImportMode = (typeof ImportModeEnum)[keyof typeof ImportModeEnum];

/** Most rows one import takes. */
export const MaxImportRows = 5000;

/** Most extra columns one import takes. */
export const MaxImportExtraColumns = 20;

// loose, since each row is checked on its own and reported back
const ImportRowSchema = object({
  name: string().max(1000),
  email: string().max(1000),
  extra: record(string().trim().min(1).max(100), string().max(1000))
    .refine((extra) => Object.keys(extra).length <= MaxImportExtraColumns, {
      message: 'Too many extra columns',
    })
    .optional(),
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
