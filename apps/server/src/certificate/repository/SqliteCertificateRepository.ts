import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { CertificateStatusEnum } from '@cert-it/shared';
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  ne,
  sql,
} from 'drizzle-orm';
import type { CourseId } from '../../course/Course';
import type { ParticipantId } from '../../participant/Participant';
import { participantTable } from '../../participant/repository/participantTable';
import type { TemplateVersionId } from '../../template/TemplateVersion';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { CertificateCode } from '../code/CertificateCode';
import type { Certificate, CertificateId } from '../Certificate';
import type { CertificateCounts } from '../CertificateCounts';
import type { CertificateRepository } from './CertificateRepository';
import { certificateStatusVersionTable } from './certificateStatusVersionTable';
import { certificateTable } from './certificateTable';

export class SqliteCertificateRepository
  extends AbstractSqliteRepository<Certificate, typeof certificateTable>
  implements CertificateRepository
{
  protected static readonly EmptyCounts: CertificateCounts = {
    [CertificateStatusEnum.Active]: 0,
    [CertificateStatusEnum.Revoked]: 0,
  };

  protected readonly table = certificateTable;

  public findByCode(code: CertificateCode): Certificate | null {
    return this.findOne({ where: eq(certificateTable.code, code) });
  }

  public findByParticipant(participantId: ParticipantId): Certificate | null {
    return this.findOne({
      where: eq(certificateTable.participantId, participantId),
    });
  }

  public listByParticipants(
    participantIds: readonly ParticipantId[],
  ): Certificate[] {
    return this.findMany({
      where: inArray(certificateTable.participantId, [...participantIds]),
    });
  }

  public findActiveByEmail(
    courseId: CourseId,
    email: NormalizedEmail,
  ): Certificate | null {
    const row = this.db
      .select(getTableColumns(certificateTable))
      .from(certificateTable)
      .innerJoin(
        participantTable,
        eq(participantTable.id, certificateTable.participantId),
      )
      .where(
        and(
          eq(certificateTable.courseId, courseId),
          eq(certificateTable.status, CertificateStatusEnum.Active),
          eq(participantTable.email, email),
        ),
      )
      .get();

    return row ? this.toModel(row) : null;
  }

  public listByCourse(
    courseId: CourseId,
    page: PageRequest,
  ): Page<Certificate> {
    return this.findPage(page, {
      where: eq(certificateTable.courseId, courseId),
      orderBy: [desc(certificateTable.id)],
    });
  }

  public listAll(): Certificate[] {
    return this.findMany();
  }

  public listAllByCourse(courseId: CourseId): Certificate[] {
    return this.findMany({ where: eq(certificateTable.courseId, courseId) });
  }

  public listWithOtherVersion(
    courseId: CourseId,
    templateVersionId: TemplateVersionId,
  ): Certificate[] {
    return this.findMany({
      where: and(
        eq(certificateTable.courseId, courseId),
        ne(certificateTable.templateVersionId, templateVersionId),
      ),
    });
  }

  public listActiveIds(): CertificateId[] {
    return this.db
      .select({ id: certificateTable.id })
      .from(certificateTable)
      .where(eq(certificateTable.status, CertificateStatusEnum.Active))
      .all()
      .map(({ id }) => id);
  }

  // AUTOINCREMENT keeps the highest ID in sqlite_sequence, even once its row is deleted
  public findHighestId(): number {
    const row = this.db.get<{ seq: number } | undefined>(
      sql`SELECT seq FROM sqlite_sequence WHERE name = 'certificates'`,
    );
    return row?.seq ?? 0;
  }

  public findStatusVersion(): number {
    const row = this.db
      .select({ version: certificateStatusVersionTable.version })
      .from(certificateStatusVersionTable)
      .get();
    return row?.version ?? 0;
  }

  public countByCourses(
    courseIds: readonly CourseId[],
  ): ReadonlyMap<CourseId, CertificateCounts> {
    const rows = this.db
      .select({
        courseId: certificateTable.courseId,
        status: certificateTable.status,
        total: count(),
      })
      .from(certificateTable)
      .where(inArray(certificateTable.courseId, [...courseIds]))
      .groupBy(certificateTable.courseId, certificateTable.status)
      .all();

    const counts = new Map<CourseId, CertificateCounts>();
    for (const { courseId, status, total } of rows) {
      const current =
        counts.get(courseId) ?? SqliteCertificateRepository.EmptyCounts;
      counts.set(courseId, { ...current, [status]: total });
    }

    return counts;
  }

  protected toModel(row: typeof certificateTable.$inferSelect): Certificate {
    return row;
  }
}
