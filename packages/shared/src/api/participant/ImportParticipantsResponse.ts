/** What an import does or would do with a row. */
export const ImportRowStatusEnum = {
  Create: 'create',
  Update: 'update',
  Skip: 'skip',
  Invalid: 'invalid',
} as const;

/** What an import does or would do with a row. */
export type ImportRowStatus =
  (typeof ImportRowStatusEnum)[keyof typeof ImportRowStatusEnum];

/** Why a valid row is skipped. */
export const ImportSkipReasonEnum = {
  /** The course has the email, and the mode is skip. */
  Exists: 'exists',
  /** The course has the email with the same name and extra columns. */
  Unchanged: 'unchanged',
  /** An earlier row of the file has the same email. */
  DuplicateInFile: 'duplicate_in_file',
} as const;

/** Why a valid row is skipped. */
export type ImportSkipReason =
  (typeof ImportSkipReasonEnum)[keyof typeof ImportSkipReasonEnum];

/** What's wrong with an invalid row. */
export const ImportRowErrorEnum = {
  NameRequired: 'name_required',
  NameTooLong: 'name_too_long',
  EmailInvalid: 'email_invalid',
} as const;

/** What's wrong with an invalid row. */
export type ImportRowError =
  (typeof ImportRowErrorEnum)[keyof typeof ImportRowErrorEnum];

/** The outcome of one row of an import. */
export type ImportRowResult = {
  /** Index of the row in the request, starting at 0. */
  readonly row: number;
  readonly status: ImportRowStatus;
  /** Set when the status is skip. */
  readonly reason?: ImportSkipReason;
  /** Set when the status is invalid. */
  readonly errors?: readonly ImportRowError[];
  /** Current name of the participant with this email, for updates and skips. */
  readonly existingName?: string;
  /** Index of the earlier row with the same email, for duplicates in the file. */
  readonly duplicateOf?: number;
};

/** The answer to an import, or to its dry run. */
export type ImportParticipantsResponse = {
  readonly dryRun: boolean;
  /** Number of rows with each status. */
  readonly totals: Readonly<Record<ImportRowStatus, number>>;
  /** One result per row, in the request's order. */
  readonly rows: readonly ImportRowResult[];
};
