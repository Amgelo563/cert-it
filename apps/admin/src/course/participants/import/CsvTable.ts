/** A CSV file read into its header and rows, as plain text cells. */
export type CsvTable = {
  readonly headers: readonly string[];
  readonly rows: readonly CsvRow[];
};

/** One non-empty line of a CSV file below its header. */
export type CsvRow = {
  /** Line number in the file, starting at 1 for the header. */
  readonly line: number;
  readonly cells: readonly string[];
};
