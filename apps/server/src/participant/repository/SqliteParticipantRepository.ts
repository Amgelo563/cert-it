import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { and, count, eq, inArray, notExists } from 'drizzle-orm';
import { certificateTable } from '../../certificate/repository/certificateTable';
import type { CourseId } from '../../course/Course';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { Participant } from '../Participant';
import { participantTable } from './participantTable';
import type { ParticipantRepository } from './ParticipantRepository';

export class SqliteParticipantRepository
  extends AbstractSqliteRepository<Participant, typeof participantTable>
  implements ParticipantRepository
{
  protected readonly table = participantTable;

  public findByEmail(
    courseId: CourseId,
    email: NormalizedEmail,
  ): Participant | null {
    return this.findOne({
      where: and(
        eq(participantTable.courseId, courseId),
        eq(participantTable.email, email),
      ),
    });
  }

  public listByCourse(
    courseId: CourseId,
    page: PageRequest,
  ): Page<Participant> {
    return this.findPage(page, {
      where: eq(participantTable.courseId, courseId),
      orderBy: [participantTable.name, participantTable.id],
    });
  }

  public listWithoutCertificate(courseId: CourseId): Participant[] {
    return this.findMany({
      where: and(
        eq(participantTable.courseId, courseId),
        notExists(
          this.db
            .select({ id: certificateTable.id })
            .from(certificateTable)
            .where(eq(certificateTable.participantId, participantTable.id)),
        ),
      ),
      orderBy: [participantTable.name, participantTable.id],
    });
  }

  public countByCourses(
    courseIds: readonly CourseId[],
  ): ReadonlyMap<CourseId, number> {
    const rows = this.db
      .select({ courseId: participantTable.courseId, total: count() })
      .from(participantTable)
      .where(inArray(participantTable.courseId, [...courseIds]))
      .groupBy(participantTable.courseId)
      .all();

    return new Map(rows.map(({ courseId, total }) => [courseId, total]));
  }

  protected toModel(row: typeof participantTable.$inferSelect): Participant {
    return row;
  }
}
