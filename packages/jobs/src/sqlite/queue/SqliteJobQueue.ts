import {
  AbstractSqliteRepository,
  type DuplicateModelError,
  type ModelNotFoundError,
  type SqliteExecutor,
} from '@cert-it/data';
import { Result } from 'better-result';
import {
  and,
  eq,
  type InferInsertModel,
  type InferSelectModel,
  inArray,
} from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { JobNotFailedError } from '../../shared/job/errors/JobNotFailedError';
import type { Job, JobId } from '../../shared/job/Job';
import { JobStatusEnum } from '../../shared/job/JobStatusEnum';
import type { JobQueue } from '../../shared/job/queue/JobQueue';
import type { SqliteJobTable } from '../table/SqliteJobTable';

export type SqliteJobQueueOptions<
  J extends Job,
  Table extends SqliteJobTable,
> = {
  db: SqliteExecutor;
  /** A table built with sqliteJobColumns. */
  table: Table;
  /** Turns a row into the app's job. @default the row as is */
  toModel?: (row: InferSelectModel<Table>) => J;
};

/** A job queue on a SQLite table built with sqliteJobColumns. */
export class SqliteJobQueue<
  J extends Job,
  Table extends SqliteJobTable,
  NewJob extends InferInsertModel<Table> = InferInsertModel<Table>,
>
  extends AbstractSqliteRepository<J, Table>
  implements JobQueue<J, NewJob>
{
  protected readonly table: Table;

  protected readonly rowToModel: (row: InferSelectModel<Table>) => J;

  constructor(options: SqliteJobQueueOptions<J, Table>) {
    super({ db: options.db });
    this.table = options.table;
    this.rowToModel = options.toModel ?? ((row) => row as unknown as J);
  }

  public enqueue(data: NewJob): Result<J, DuplicateModelError> {
    return this.create(data);
  }

  public claimNext(now: Date): J | null {
    const { table } = this;
    const next = this.db
      .select({ id: table.id })
      .from(table as SQLiteTable)
      .where(eq(table.status, JobStatusEnum.Pending))
      .orderBy(table.id)
      .limit(1);

    // claims and marks in one statement, so a job can't be claimed twice
    const row = this.db
      .update(table as SQLiteTable)
      .set({ status: JobStatusEnum.Running, startedAt: now })
      .where(
        and(inArray(table.id, next), eq(table.status, JobStatusEnum.Pending)),
      )
      .returning()
      .get();

    return row ? this.toModel(row as InferSelectModel<Table>) : null;
  }

  public setProgress(id: JobId, progress: number, total?: number): void {
    this.updateRunning(id, {
      progress,
      ...(total === undefined ? {} : { total }),
    });
  }

  public complete(id: JobId, output: unknown, now: Date): void {
    this.updateRunning(id, {
      status: JobStatusEnum.Completed,
      output: output ?? null,
      finishedAt: now,
    });
  }

  public fail(id: JobId, error: string, now: Date): void {
    this.updateRunning(id, {
      status: JobStatusEnum.Failed,
      error,
      finishedAt: now,
    });
  }

  public failRunning(error: string, now: Date): number {
    return this.db
      .update(this.table as SQLiteTable)
      .set({ status: JobStatusEnum.Failed, error, finishedAt: now })
      .where(eq(this.table.status, JobStatusEnum.Running))
      .run().changes;
  }

  public retry(id: JobId): Result<J, ModelNotFoundError | JobNotFailedError> {
    const { table } = this;
    const row = this.db
      .update(table as SQLiteTable)
      .set({
        status: JobStatusEnum.Pending,
        progress: 0,
        output: null,
        error: null,
        startedAt: null,
        finishedAt: null,
      })
      .where(and(eq(table.id, id), eq(table.status, JobStatusEnum.Failed)))
      .returning()
      .get();
    if (row) return Result.ok(this.toModel(row as InferSelectModel<Table>));

    // nothing changed: tell a missing job from one that isn't failed
    const job = this.findById(id);
    return job
      ? Result.err(new JobNotFailedError({ id, status: job.status }))
      : Result.err(this.notFound(id));
  }

  // only a running job's state changes, so a late message can't reopen a finished job
  protected updateRunning(id: JobId, values: Record<string, unknown>): void {
    this.db
      .update(this.table as SQLiteTable)
      .set(values)
      .where(
        and(
          eq(this.table.id, id),
          eq(this.table.status, JobStatusEnum.Running),
        ),
      )
      .run();
  }

  protected toModel(row: InferSelectModel<Table>): J {
    return this.rowToModel(row);
  }
}
