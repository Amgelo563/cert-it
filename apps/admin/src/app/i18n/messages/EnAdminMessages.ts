import { EnAuditLogMessages } from '../../../audit/i18n/EnAuditLogMessages';
import { EnAuthMessages } from '../../../auth/i18n/EnAuthMessages';
import { EnCourseMessages } from '../../../course/i18n/EnCourseMessages';
import { EnCertificateMessages } from '../../../course/certificates/i18n/EnCertificateMessages';
import { EnFieldMessages } from '../../../course/fields/i18n/EnFieldMessages';
import { EnParticipantMessages } from '../../../course/participants/i18n/EnParticipantMessages';
import { EnOnboardingMessages } from '../../../onboarding/i18n/EnOnboardingMessages';
import { EnUserMessages } from '../../../user/i18n/EnUserMessages';
import type { AdminMessages } from './AdminMessages';
import { EnAppMessages } from './EnAppMessages';

export const EnAdminMessages = {
  ...EnAppMessages,
  ...EnAuthMessages,
  ...EnCourseMessages,
  ...EnParticipantMessages,
  ...EnFieldMessages,
  ...EnCertificateMessages,
  ...EnUserMessages,
  ...EnAuditLogMessages,
  ...EnOnboardingMessages,
} satisfies AdminMessages;
