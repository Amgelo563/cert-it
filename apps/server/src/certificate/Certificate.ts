import type { Brand, CertificateStatus } from '@cert-it/shared';
import type { CourseId } from '../course/Course';
import type { ParticipantId } from '../participant/Participant';
import type { TemplateVersionId } from '../template/TemplateVersion';
import type { CertificateCode } from './code/CertificateCode';

export type CertificateId = Brand<number, 'CertificateId'>;

/** A certificate issued to a participant, whose PDF is stored at `certificates/<courseId>/<code>.pdf`. */
export type Certificate = {
  readonly id: CertificateId;
  readonly code: CertificateCode;
  /** Its bit in the revocation status list, picked at random and never reused. */
  readonly statusIndex: number;
  readonly courseId: CourseId;
  /** Unique: a participant has at most one certificate. */
  readonly participantId: ParticipantId;
  /** The template version the PDF was rendered with. */
  readonly templateVersionId: TemplateVersionId;
  /** The date printed on the certificate, as `YYYY-MM-DD`. */
  readonly issueDate: string;
  readonly status: CertificateStatus;
  /** When it was revoked, or null if it's active. */
  readonly revokedAt: Date | null;
  /** Why it was revoked, or null if it's active. */
  readonly revokedReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};
