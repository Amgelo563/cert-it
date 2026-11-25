import type { AuditLogMessages } from '../../../audit/i18n/AuditLogMessages';
import type { AuthMessages } from '../../../auth/i18n/AuthMessages';
import type { CourseMessages } from '../../../course/i18n/CourseMessages';
import type { ParticipantMessages } from '../../../course/participants/i18n/ParticipantMessages';
import type { FieldMessages } from '../../../course/fields/i18n/FieldMessages';
import type { CertificateMessages } from '../../../course/certificates/i18n/CertificateMessages';
import type { OnboardingMessages } from '../../../onboarding/i18n/OnboardingMessages';
import type { UserMessages } from '../../../user/i18n/UserMessages';
import type { AppMessages } from './AppMessages';

/** Texts of the admin panel, in one language: each feature's sections, kept next to the feature. */
export type AdminMessages = AppMessages
  & AuthMessages
  & CourseMessages
  & ParticipantMessages
  & FieldMessages
  & CertificateMessages
  & UserMessages
  & AuditLogMessages
  & OnboardingMessages;
