import type { CertificateStatus } from '../../certificate/CertificateStatusEnum';
import type { Locale } from '../../i18n/LocaleEnum';

/** A course, as the course routes return it, with its counts. */
export type CourseSummary = {
  readonly id: number;
  readonly name: string;
  readonly locale: Locale;
  /** dayjs format of the dates on its certificates. */
  readonly dateFormat: string;
  readonly lookupEnabled: boolean;
  readonly active: boolean;
  /** ISO 8601 date and time. */
  readonly createdAt: string;
  readonly participantCount: number;
  /** Number of the newest template version, or null if it has no template yet. */
  readonly latestTemplateVersion: number | null;
  /** Whether the newest template version prints the participant's name; false without a template. */
  readonly latestTemplateHasName: boolean;
  readonly certificateCounts: Readonly<Record<CertificateStatus, number>>;
};
