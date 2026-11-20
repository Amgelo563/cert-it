import { TaggedError } from 'better-result';
import type { JobId } from '../Job';
import type { JobStatus } from '../JobStatusEnum';

/** An error for retrying a job that hasn't failed. */
export class JobNotFailedError extends TaggedError('JobNotFailedError')<{
  id: JobId;
  status: JobStatus;
  message: string;
}> {
  constructor(args: { id: JobId; status: JobStatus }) {
    super({
      ...args,
      message: `Job ${args.id} can't be retried because it's ${args.status}, not failed.`,
    });
  }
}
