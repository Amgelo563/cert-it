export const BasePdfProblemEnum = {
  /** pdf-lib can't parse it, so it's broken or isn't a PDF. */
  Invalid: 'invalid',
  Encrypted: 'encrypted',
  /** It has no pages, or more than one. */
  NotOnePage: 'not_one_page',
} as const;

/** Why a file can't be used as a base PDF. */
export type BasePdfProblem =
  (typeof BasePdfProblemEnum)[keyof typeof BasePdfProblemEnum];
