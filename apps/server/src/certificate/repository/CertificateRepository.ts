import type {
  DuplicateModelError,
  ModelNotFoundError,
  Page,
  PageRequest,
} from '@cert-it/data';
import type { CertificateStatus } from '@cert-it/shared';
import type { Result } from 'better-result';
import type { CourseId } from '../../course/Course';
import type { ParticipantId } from '../../participant/Participant';
import type { TemplateVersionId } from '../../template/TemplateVersion';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { CertificateCode } from '../code/CertificateCode';
import type { Certificate, CertificateId } from '../Certificate';
import type { CertificateCounts } from '../CertificateCounts';

/** An object that stores and queries issued certificates. */
export interface CertificateRepository {
  /** Returns the certificate with the given ID, or null if there's none. */
  findById(id: CertificateId): Certificate | null;

  /** Returns the certificates with the given IDs, skipping missing ones. */
  findByIds(ids: readonly CertificateId[]): Certificate[];

  /** Returns the certificate with the given code, or null if there's none. */
  findByCode(code: CertificateCode): Certificate | null;

  /** Returns the certificate of a participant, or null if they have none. */
  findByParticipant(participantId: ParticipantId): Certificate | null;

  /** Returns the active certificate of the course's participant with the given email, or null if there's none. */
  findActiveByEmail(
    courseId: CourseId,
    email: NormalizedEmail,
  ): Certificate | null;

  /** Creates a certificate with a random, unused status index, unless its code is taken or the participant already has one. */
  create(data: {
    code: CertificateCode;
    courseId: CourseId;
    participantId: ParticipantId;
    templateVersionId: TemplateVersionId;
    issueDate: string;
  }): Result<Certificate, DuplicateModelError>;

  /** Updates the given fields of a certificate. */
  update(
    id: CertificateId,
    data: {
      templateVersionId?: TemplateVersionId;
      issueDate?: string;
      status?: CertificateStatus;
      revokedAt?: Date | null;
      revokedReason?: string | null;
    },
  ): Result<Certificate, ModelNotFoundError | DuplicateModelError>;

  /** Deletes a certificate. */
  delete(id: CertificateId): Result<void, ModelNotFoundError>;

  /** Returns the certificates of the given participants, skipping those without one. */
  listByParticipants(participantIds: readonly ParticipantId[]): Certificate[];

  /** Returns a page of the certificates of a course, newest first. */
  listByCourse(courseId: CourseId, page: PageRequest): Page<Certificate>;

  /** Returns every certificate, of every course, oldest first. */
  listAll(): Certificate[];

  /** Returns every certificate of a course, oldest first. */
  listAllByCourse(courseId: CourseId): Certificate[];

  /** Returns the certificates of a course rendered with a template version other than the given one, oldest first. */
  listWithOtherVersion(
    courseId: CourseId,
    templateVersionId: TemplateVersionId,
  ): Certificate[];

  /** Returns the status indexes to mark revoked: those of revoked certificates and of deleted ones. */
  listRevokedStatusIndexes(): number[];

  /** Returns the number of bits of the status list, which covers every status index given out. */
  findStatusListLength(): number;

  /** Returns the highest ID ever given to a certificate, deleted ones included, or 0 if there's been none. IDs are never reused. */
  findHighestId(): number;

  /** Returns a number that changes whenever a certificate is created, deleted or changes status, from any process. */
  findStatusVersion(): number;

  /** Returns the number of certificates of each given course in each status, leaving out courses with none. */
  countByCourses(
    courseIds: readonly CourseId[],
  ): ReadonlyMap<CourseId, CertificateCounts>;
}
