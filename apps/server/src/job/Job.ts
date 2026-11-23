import type { JobOf } from '@cert-it/jobs';
import type { CourseId } from '../course/Course';
import type { UserId } from '../user/User';
import type { JobTask } from './JobTask';

/** A background job that generates the certificates of a course. Its progress and total count certificates. */
export type Job = JobOf<JobTask> & {
  readonly courseId: CourseId;
  readonly createdBy: UserId | null;
};
