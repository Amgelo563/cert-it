import type { InferInsertModel } from 'drizzle-orm';
import type { Job } from '../../shared/job/Job';
import {
  JobRunner,
  type JobRunnerOptions,
} from '../../shared/runner/JobRunner';
import { JobDispatcher } from '../../shared/dispatcher/JobDispatcher';
import {
  SqliteJobQueue,
  type SqliteJobQueueOptions,
} from '../queue/SqliteJobQueue';
import type { SqliteJobTable } from '../table/SqliteJobTable';

type SqliteJobDispatcherOptions<
  J extends Job,
  Table extends SqliteJobTable,
> = SqliteJobQueueOptions<J, Table> & Omit<JobRunnerOptions<J>, 'queue'>;

/** A JobDispatcher on a SQLite table built with sqliteJobColumns, with its own queue and runner. */
export class SqliteJobDispatcher<
  J extends Job,
  Table extends SqliteJobTable,
  NewJob extends InferInsertModel<Table> = InferInsertModel<Table>,
> extends JobDispatcher<J, NewJob> {
  constructor(options: SqliteJobDispatcherOptions<J, Table>) {
    const { db, table, toModel, ...runnerOptions } = options;
    const queue = new SqliteJobQueue<J, Table, NewJob>({ db, table, toModel });

    super({ queue, runner: new JobRunner({ ...runnerOptions, queue }) });
  }
}
