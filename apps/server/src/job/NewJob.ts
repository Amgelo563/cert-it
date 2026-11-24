import type { CourseId } from '../course/Course';
import type { UserId } from '../user/User';
import type { JobTask } from './JobTask';

/** The data of a job to add, which BackgroundJobService takes. */
export type NewJob = JobTask & {
  courseId: CourseId;
  /** The number of certificates to process. */
  total: number;
  /** Null when the app adds it on its own. */
  createdBy: UserId | null;
};
