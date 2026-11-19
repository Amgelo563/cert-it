import type { Brand } from '@cert-it/shared';
import type { CourseId } from '../course/Course';
import type { UserId } from '../user/User';
import type { JobStatus } from './JobStatusEnum';
import type { JobTask } from './JobTask';

export type JobId = Brand<number, 'JobId'>;

/** A background job that generates the certificates of a course. */
export type Job = {
  readonly id: JobId;
  readonly courseId: CourseId;
  readonly status: JobStatus;
  /** The number of certificates already processed. */
  readonly progress: number;
  /** The number of certificates to process. */
  readonly total: number;
  /** Why the job failed, or null if it hasn't. */
  readonly error: string | null;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
} & JobTask;
