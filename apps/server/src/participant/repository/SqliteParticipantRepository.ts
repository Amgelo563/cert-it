import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import {
  ParticipantCertificateFilterEnum,
  type ParticipantCertificateFilter,
} from '@cert-it/shared';
import {
  and,
  count,
  eq,
  exists,
  inArray,
  notExists,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
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

  public listByEmails(
    courseId: CourseId,
    emails: readonly NormalizedEmail[],
  ): Participant[] {
    const found: Participant[] = [];
    // in chunks, under SQLite's limit of bound parameters
    for (let start = 0; start < emails.length; start += 500) {
      found.push(
        ...this.findMany({
          where: and(
            eq(participantTable.courseId, courseId),
            inArray(participantTable.email, emails.slice(start, start + 500)),
          ),
        }),
      );
    }
    return found;
  }

  public listByCourse(
    courseId: CourseId,
    page: PageRequest,
    search?: string,
    certificate?: ParticipantCertificateFilter,
  ): Page<Participant> {
    const text = search?.trim();
    // escaped with !, so % and _ in the search match themselves
    const pattern = text ? `%${text.replace(/[!%_]/g, '!$&')}%` : null;

    return this.findPage(page, {
      where: and(
        eq(participantTable.courseId, courseId),
        certificate === undefined ? undefined : this.byCertificate(certificate),
        pattern === null
          ? undefined
          : or(
              sql`${participantTable.name} LIKE ${pattern} ESCAPE '!'`,
              sql`${participantTable.email} LIKE ${pattern} ESCAPE '!'`,
            ),
      ),
      orderBy: [participantTable.name, participantTable.id],
    });
  }

  public listWithoutCertificate(courseId: CourseId): Participant[] {
    return this.findMany({
      where: and(
        eq(participantTable.courseId, courseId),
        this.byCertificate(ParticipantCertificateFilterEnum.None),
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

  // none: no certificate row; otherwise one in that status
  protected byCertificate(filter: ParticipantCertificateFilter): SQL {
    const certificates = this.db
      .select({ id: certificateTable.id })
      .from(certificateTable);
    if (filter === ParticipantCertificateFilterEnum.None) {
      return notExists(
        certificates.where(
          eq(certificateTable.participantId, participantTable.id),
        ),
      );
    }
    return exists(
      certificates.where(
        and(
          eq(certificateTable.participantId, participantTable.id),
          eq(certificateTable.status, filter),
        ),
      ),
    );
  }

  protected toModel(row: typeof participantTable.$inferSelect): Participant {
    return row;
  }
}
