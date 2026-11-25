import { AbstractSqliteRepository } from '@cert-it/data';
import type { CourseFieldType } from '@cert-it/shared';
import { eq } from 'drizzle-orm';
import type { CourseId } from '../../course/Course';
import type { CourseField } from '../CourseField';
import { courseFieldTable } from './courseFieldTable';
import type { CourseFieldRepository } from './CourseFieldRepository';

export class SqliteCourseFieldRepository
  extends AbstractSqliteRepository<CourseField, typeof courseFieldTable>
  implements CourseFieldRepository
{
  protected readonly table = courseFieldTable;

  public listByCourse(courseId: CourseId): CourseField[] {
    return this.findMany({
      where: eq(courseFieldTable.courseId, courseId),
      orderBy: [courseFieldTable.position, courseFieldTable.id],
    });
  }

  public listByType(type: CourseFieldType): CourseField[] {
    return this.findMany({ where: eq(courseFieldTable.type, type) });
  }

  protected toModel(row: typeof courseFieldTable.$inferSelect): CourseField {
    return row;
  }
}
