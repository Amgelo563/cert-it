import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import type { Result } from 'better-result';
import type { JobNotFailedError } from '../job/errors/JobNotFailedError';
import type { Job, JobId } from '../job/Job';
import type { JobQueue } from '../job/queue/JobQueue';
import type { JobRunner } from '../runner/JobRunner';

export type JobServiceOptions<J extends Job, NewJob> = {
  queue: JobQueue<J, NewJob>;
  runner: JobRunner<J>;
};

/** Adds background jobs and runs them. The only way app code adds a job, so the runner always hears about it. */
export class JobService<J extends Job, NewJob> {
  protected readonly queue: JobQueue<J, NewJob>;

  protected readonly runner: JobRunner<J>;

  constructor(options: JobServiceOptions<J, NewJob>) {
    this.queue = options.queue;
    this.runner = options.runner;
  }

  /** Marks jobs a restart cut off as failed, then starts any pending ones. Call it once the database is ready. */
  public start(): void {
    this.runner.start();
  }

  /**
   * Adds a pending job and starts it if nothing else is running.
   *
   * Called inside a transaction on the same connection, the job is part of it: it starts once the transaction commits, and disappears if it rolls back.
   */
  public add(data: NewJob): Result<J, DuplicateModelError> {
    const result = this.queue.enqueue(data);
    if (result.isOk()) this.wakeSoon();

    return result;
  }

  /** Puts a failed job back in the queue and starts it if nothing else is running. Like add, it can run inside a transaction. */
  public retry(id: JobId): Result<J, ModelNotFoundError | JobNotFailedError> {
    const result = this.queue.retry(id);
    if (result.isOk()) this.wakeSoon();

    return result;
  }

  /** Stops the worker, waiting for the current job up to the given time before killing it. A killed job stays running until the next start. */
  public stop(options?: { graceMs?: number }): Promise<void> {
    return this.runner.stop(options);
  }

  /** Returns whether a job is running. */
  public isBusy(): boolean {
    return this.runner.isBusy();
  }

  // on the next tick a surrounding transaction has committed or rolled back, so the runner sees the real state
  protected wakeSoon(): void {
    setImmediate(() => this.runner.wake());
  }
}
