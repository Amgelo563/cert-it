import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import {
  type JobId,
  type JobNotFailedError,
  SqliteJobQueue,
} from '@cert-it/jobs';
import type { Result } from 'better-result';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { BackgroundJobService } from '../../../src/job/BackgroundJobService';
import type { Job } from '../../../src/job/Job';
import type { NewJob } from '../../../src/job/NewJob';
import { jobTable } from '../../../src/job/repository/jobTable';

/** A BackgroundJobService that saves and retries jobs but never runs them, so route tests start no generator process. */
export class QueueOnlyJobService extends BackgroundJobService {
  constructor(database: DatabaseService) {
    super({
      database,
      settings: () => {
        throw new Error('QueueOnlyJobService never starts a generator.');
      },
    });
  }

  public override start(): void {}

  public override stop(): Promise<void> {
    return Promise.resolve();
  }

  public override add(data: NewJob): Result<Job, DuplicateModelError> {
    return this.createQueue().enqueue(data);
  }

  public override retry(
    id: JobId,
  ): Result<Job, ModelNotFoundError | JobNotFailedError> {
    return this.createQueue().retry(id);
  }

  // on the current connection, as the real service does
  protected createQueue(): SqliteJobQueue<Job, typeof jobTable, NewJob> {
    return new SqliteJobQueue<Job, typeof jobTable, NewJob>({
      db: this.database.getExecutor(),
      table: jobTable,
      toModel: (row) => row as Job,
    });
  }
}
