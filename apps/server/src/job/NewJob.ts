import type { CourseId } from '../course/Course';
import type { UserId } from '../user/User';
import type { JobTask } from './JobTask';

/** The data of a job to add, which JobService takes. */
export type NewJob = JobTask & {
  courseId: CourseId;
  /** The number of certificates to process. */
  total: number;
  createdBy: UserId;
};
