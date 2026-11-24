import type { Page, PageRequest } from '@cert-it/data';
import type { JobId } from '@cert-it/jobs';
import type { CourseId } from '../../course/Course';
import type { Job } from '../Job';

/** An object that queries background jobs. Jobs are added and change state only through BackgroundJobService. */
export interface JobRepository {
  /** Returns the job with the given ID, or null if there's none. */
  findById(id: JobId): Job | null;

  /** Returns a page of the jobs of a course, newest first. */
  listByCourse(courseId: CourseId, page: PageRequest): Page<Job>;
}
