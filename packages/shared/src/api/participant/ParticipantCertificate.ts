import type { CertificateStatus } from '../../certificate/CertificateStatusEnum';

/** A participant's certificate, as the participant routes show it. */
export type ParticipantCertificate = {
  readonly id: number;
  /** Code in the certificate's public URL and file URL. */
  readonly code: string;
  readonly status: CertificateStatus;
  /** Number of the template version it was rendered with. */
  readonly templateVersion: number;
  /** The date printed on it, as `YYYY-MM-DD`. */
  readonly issueDate: string;
};
