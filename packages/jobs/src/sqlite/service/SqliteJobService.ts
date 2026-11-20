import type { InferInsertModel } from 'drizzle-orm';
import type { Job } from '../../shared/job/Job';
import {
  JobRunner,
  type JobRunnerOptions,
} from '../../shared/runner/JobRunner';
import { JobService } from '../../shared/service/JobService';
import {
  SqliteJobQueue,
  type SqliteJobQueueOptions,
} from '../queue/SqliteJobQueue';
import type { SqliteJobTable } from '../table/SqliteJobTable';

type SqliteJobServiceOptions<
  J extends Job,
  Table extends SqliteJobTable,
> = SqliteJobQueueOptions<J, Table> & Omit<JobRunnerOptions<J>, 'queue'>;

/** A JobService on a SQLite table built with sqliteJobColumns, with its own queue and runner. */
export class SqliteJobService<
  J extends Job,
  Table extends SqliteJobTable,
  NewJob extends InferInsertModel<Table> = InferInsertModel<Table>,
> extends JobService<J, NewJob> {
  constructor(options: SqliteJobServiceOptions<J, Table>) {
    const { db, table, toModel, ...runnerOptions } = options;
    const queue = new SqliteJobQueue<J, Table, NewJob>({ db, table, toModel });

    super({ queue, runner: new JobRunner({ ...runnerOptions, queue }) });
  }
}
