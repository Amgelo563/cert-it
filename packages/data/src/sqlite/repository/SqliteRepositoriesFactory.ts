import type { SqliteExecutor } from '../database/SqliteExecutor';

/** A function that creates a project's repositories bound to the given database or transaction. */
export type SqliteRepositoriesFactory<Repositories> = (
  db: SqliteExecutor,
) => Repositories;
