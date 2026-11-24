import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { desc, eq } from 'drizzle-orm';
import type { CourseId } from '../../course/Course';
import type { Job } from '../Job';
import { jobTable } from './jobTable';
import type { JobRepository } from './JobRepository';

export class SqliteJobRepository
  extends AbstractSqliteRepository<Job, typeof jobTable>
  implements JobRepository
{
  protected readonly table = jobTable;

  public listByCourse(courseId: CourseId, page: PageRequest): Page<Job> {
    return this.findPage(page, {
      where: eq(jobTable.courseId, courseId),
      orderBy: [desc(jobTable.id)],
    });
  }

  // the type column decides the payload's shape, which only BackgroundJobService writes
  protected toModel(row: typeof jobTable.$inferSelect): Job {
    return row as Job;
  }
}
