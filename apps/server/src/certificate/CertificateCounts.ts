import type { CertificateStatus } from '@cert-it/shared';

/** The number of certificates of a course in each status. */
export type CertificateCounts = Readonly<Record<CertificateStatus, number>>;
