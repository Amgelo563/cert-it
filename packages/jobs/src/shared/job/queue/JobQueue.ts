import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import type { Result } from 'better-result';
import type { JobNotFailedError } from '../errors/JobNotFailedError';
import type { Job, JobId } from '../Job';

/** An object that stores background jobs, hands out pending ones and saves their state as they run. The only way a job is added or changes state. */
export interface JobQueue<J extends Job, NewJob> {
  /** Adds a pending job. */
  enqueue(data: NewJob): Result<J, DuplicateModelError>;

  /** Marks the oldest pending job as running and returns it, or returns null if there's none. */
  claimNext(now: Date): J | null;

  /** Saves how many items of a running job are done, and how many there are when given. */
  setProgress(id: JobId, progress: number, total?: number): void;

  /** Marks a running job as completed with the handler's output. */
  complete(id: JobId, output: unknown, now: Date): void;

  /** Marks a running job as failed with the given reason. */
  fail(id: JobId, error: string, now: Date): void;

  /** Marks every running job as failed, returning how many there were. Used at startup for jobs a restart cut off. */
  failRunning(error: string, now: Date): number;

  /** Puts a failed job back in the queue, keeping its payload and clearing its progress, output and error. */
  retry(id: JobId): Result<J, ModelNotFoundError | JobNotFailedError>;
}
