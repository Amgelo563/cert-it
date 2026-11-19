import type { Result } from 'better-result';

/** An object that runs several repository operations atomically. */
export interface UnitOfWork<Repositories> {
  /** Runs the given work in one transaction, rolling it back if the work returns an error or throws. */
  transaction<T, E>(
    work: (repositories: Repositories) => Result<T, E>,
  ): Result<T, E>;
}
