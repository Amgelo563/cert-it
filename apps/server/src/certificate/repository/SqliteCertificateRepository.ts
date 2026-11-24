import { randomInt } from 'node:crypto';
import {
  AbstractSqliteRepository,
  type DuplicateModelError,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { CertificateStatusEnum } from '@cert-it/shared';
import type { Result } from 'better-result';
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
import type { Certificate } from '../Certificate';
import type { CertificateCounts } from '../CertificateCounts';
import type { CertificateRepository } from './CertificateRepository';
import { certificateStatusVersionTable } from './certificateStatusVersionTable';
import { certificateTable } from './certificateTable';
import { retiredStatusIndexTable } from './retiredStatusIndexTable';

type NewCertificate = Omit<typeof certificateTable.$inferInsert, 'statusIndex'>;

export class SqliteCertificateRepository
  extends AbstractSqliteRepository<Certificate, typeof certificateTable>
  implements CertificateRepository
{
  /** The shortest status list, 16 KB, so a small issuer's certificates hide among many indexes. */
  public static readonly MinStatusListLength = 131_072;
  protected static readonly EmptyCounts: CertificateCounts = {
    [CertificateStatusEnum.Active]: 0,
    [CertificateStatusEnum.Revoked]: 0,
  };
  // with at least half the list free, missing this many times in a row is practically impossible
  protected static readonly MaxStatusIndexAttempts = 64;
  protected readonly table = certificateTable;

  /**
   * Returns the number of bits of the status list, given how many indexes were ever given out.
   * It doubles to keep at least half of them free, so a random free index is quick to find, and never shrinks, since the count only grows.
   */
  public static statusListLength(allocated: number): number {
    let length = SqliteCertificateRepository.MinStatusListLength;
    while (allocated * 2 > length) length *= 2;
    return length;
  }

  // a random index, so the list shows neither issuance order nor how many are active
  public override create(
    data: NewCertificate,
  ): Result<Certificate, DuplicateModelError> {
    const length = SqliteCertificateRepository.statusListLength(
      this.countStatusIndexes() + 1,
    );

    for (
      let i = 0;
      i < SqliteCertificateRepository.MaxStatusIndexAttempts;
      i++
    ) {
      const statusIndex = randomInt(length);
      if (this.isStatusIndexTaken(statusIndex)) continue;

      const created = super.create({ ...data, statusIndex });
      // another process took it in between
      if (created.isErr() && created.error.isOn('statusIndex')) {
        continue;
      }
      return created;
    }

    throw new Error(
      `No free status index after ${SqliteCertificateRepository.MaxStatusIndexAttempts} tries.`,
    );
  }

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

  public listRevokedStatusIndexes(): number[] {
    const revoked = this.db
      .select({ statusIndex: certificateTable.statusIndex })
      .from(certificateTable)
      .where(eq(certificateTable.status, CertificateStatusEnum.Revoked))
      .all();
    const retired = this.db.select().from(retiredStatusIndexTable).all();

    return [...revoked, ...retired].map(({ statusIndex }) => statusIndex);
  }

  public findStatusListLength(): number {
    return SqliteCertificateRepository.statusListLength(
      this.countStatusIndexes(),
    );
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

  protected countStatusIndexes(): number {
    const [certificates] = this.db
      .select({ total: count() })
      .from(certificateTable)
      .all();
    const [retired] = this.db
      .select({ total: count() })
      .from(retiredStatusIndexTable)
      .all();

    return (certificates?.total ?? 0) + (retired?.total ?? 0);
  }

  protected isStatusIndexTaken(statusIndex: number): boolean {
    const live = this.db
      .select({ id: certificateTable.id })
      .from(certificateTable)
      .where(eq(certificateTable.statusIndex, statusIndex))
      .get();
    const retired = this.db
      .select()
      .from(retiredStatusIndexTable)
      .where(eq(retiredStatusIndexTable.statusIndex, statusIndex))
      .get();

    return Boolean(live ?? retired);
  }

  protected toModel(row: typeof certificateTable.$inferSelect): Certificate {
    return row;
  }
}
