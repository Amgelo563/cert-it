import type { Result } from 'better-result';
import { TransactionRollbackError } from 'drizzle-orm';
import type { UnitOfWork } from '../../shared/transaction/UnitOfWork';
import type { SqliteExecutor } from '../database/SqliteExecutor';
import type { SqliteRepositoriesFactory } from '../repository/SqliteRepositoriesFactory';

type SqliteUnitOfWorkOptions<Repositories> = {
  db: SqliteExecutor;
  createRepositories: SqliteRepositoriesFactory<Repositories>;
};

export class SqliteUnitOfWork<
  Repositories,
> implements UnitOfWork<Repositories> {
  protected readonly db: SqliteExecutor;

  protected readonly createRepositories: SqliteRepositoriesFactory<Repositories>;

  constructor(options: SqliteUnitOfWorkOptions<Repositories>) {
    this.db = options.db;
    this.createRepositories = options.createRepositories;
  }

  public transaction<T, E>(
    work: (repositories: Repositories) => Result<T, E>,
  ): Result<T, E> {
    let result = null as Result<T, E> | null;

    try {
      return this.db.transaction(
        (tx) => {
          result = work(this.createRepositories(tx));
          if (result.isErr()) tx.rollback();

          return result;
        },
        { behavior: 'immediate' },
      );
    } catch (error) {
      if (error instanceof TransactionRollbackError && result?.isErr()) {
        return result;
      }

      throw error;
    }
  }
}
