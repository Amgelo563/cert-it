import type { CertificateStatus } from '../../certificate/CertificateStatusEnum';

/** A certificate, as the certificate routes return it. */
export type CertificateSummary = {
  readonly id: number;
  readonly code: string;
  readonly participantId: number;
  readonly status: CertificateStatus;
  /** Number of the template version it was rendered with. */
  readonly templateVersion: number;
  /** The date printed on it, as `YYYY-MM-DD`. */
  readonly issueDate: string;
  /** ISO timestamp of the revocation, or null if it's active. */
  readonly revokedAt: string | null;
  readonly revokedReason: string | null;
};
