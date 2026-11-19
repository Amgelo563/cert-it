import type {
  DuplicateModelError,
  ModelNotFoundError,
  Page,
  PageRequest,
} from '@cert-it/data';
import type { Result } from 'better-result';
import type { CourseId } from '../../course/Course';
import type { UserId } from '../../user/User';
import type { Job, JobId } from '../Job';
import type { JobStatus } from '../JobStatusEnum';
import type { JobTask } from '../JobTask';

type NewJob = JobTask & {
  courseId: CourseId;
  total: number;
  createdBy: UserId;
};

/** An object that stores and queries background jobs. */
export interface JobRepository {
  /** Returns the job with the given ID, or null if there's none. */
  findById(id: JobId): Job | null;

  /** Returns the oldest pending job, or null if there's none. */
  findNextPending(): Job | null;

  /** Creates a pending job. */
  create(data: NewJob): Result<Job, DuplicateModelError>;

  /** Updates the given fields of a job. */
  update(
    id: JobId,
    data: {
      status?: JobStatus;
      progress?: number;
      error?: string | null;
      startedAt?: Date | null;
      finishedAt?: Date | null;
    },
  ): Result<Job, ModelNotFoundError | DuplicateModelError>;

  /** Returns a page of the jobs of a course, newest first. */
  listByCourse(courseId: CourseId, page: PageRequest): Page<Job>;

  /** Marks every running job as failed with the given error, returning how many were, for jobs a restart interrupted. */
  failRunning(error: string, now: Date): number;
}
