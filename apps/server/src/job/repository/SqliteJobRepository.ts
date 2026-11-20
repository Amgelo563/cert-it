import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { desc, eq } from 'drizzle-orm';
import type { CourseId } from '../../course/Course';
import type { Job } from '../Job';
import { JobStatusEnum } from '../JobStatusEnum';
import { jobTable } from './jobTable';
import type { JobRepository } from './JobRepository';

export class SqliteJobRepository
  extends AbstractSqliteRepository<Job, typeof jobTable>
  implements JobRepository
{
  protected readonly table = jobTable;

  public findNextPending(): Job | null {
    return this.findOne({ where: eq(jobTable.status, JobStatusEnum.Pending) });
  }

  public listByCourse(courseId: CourseId, page: PageRequest): Page<Job> {
    return this.findPage(page, {
      where: eq(jobTable.courseId, courseId),
      orderBy: [desc(jobTable.id)],
    });
  }

  public failRunning(error: string, now: Date): number {
    return this.db
      .update(jobTable)
      .set({ status: JobStatusEnum.Failed, error, finishedAt: now })
      .where(eq(jobTable.status, JobStatusEnum.Running))
      .run().changes;
  }

  // the type column decides the payload's shape, which only create() writes
  protected toModel(row: typeof jobTable.$inferSelect): Job {
    return row as Job;
  }
}
