import { TaggedError } from 'better-result';

/** A row whose foreign key points at a row that doesn't exist, as reported by `PRAGMA foreign_key_check`. */
type ForeignKeyViolation = {
  table: string;
  rowid: number | null;
  parent: string;
};

/** An error for rows that point at missing rows after applying migrations. */
export class ForeignKeyViolationError extends TaggedError(
  'ForeignKeyViolationError',
)<{
  violations: readonly ForeignKeyViolation[];
  message: string;
}> {
  constructor(args: { violations: readonly ForeignKeyViolation[] }) {
    super({
      ...args,
      message: `Migrations left ${args.violations.length} rows pointing at missing rows (${[
        ...new Set(
          args.violations.map(({ table, parent }) => `${table} => ${parent}`),
        ),
      ].join(', ')}). Fix them with a new migration or restore a backup.`,
    });
  }
}
