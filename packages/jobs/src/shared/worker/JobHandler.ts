import type { Result } from 'better-result';
import type { Job } from '../job/Job';
import type { JobContext } from './JobContext';

/** An object that does the work of one type of job. Runs in the worker process, and must be safe to run twice for a retried job. */
export interface JobHandler<
  J extends Job = Job,
  Output = unknown,
  E extends Error = Error,
> {
  /** Does the job's work, returning the output to save with it, or why it couldn't be done. */
  run(job: J, context: JobContext): Promise<Result<Output, E>>;
}
