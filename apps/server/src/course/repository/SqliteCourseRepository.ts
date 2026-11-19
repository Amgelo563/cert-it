import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { and, desc, eq } from 'drizzle-orm';
import type { Course } from '../Course';
import { courseTable } from './courseTable';
import type { CourseRepository } from './CourseRepository';

export class SqliteCourseRepository
  extends AbstractSqliteRepository<Course, typeof courseTable>
  implements CourseRepository
{
  protected readonly table = courseTable;

  public list(page: PageRequest): Page<Course> {
    return this.findPage(page, { orderBy: [desc(courseTable.id)] });
  }

  public listForLookup(): Course[] {
    return this.db
      .select()
      .from(courseTable)
      .where(
        and(eq(courseTable.active, true), eq(courseTable.lookupEnabled, true)),
      )
      .orderBy(courseTable.name)
      .all()
      .map((row) => this.toModel(row));
  }

  protected toModel(row: typeof courseTable.$inferSelect): Course {
    return row;
  }
}
