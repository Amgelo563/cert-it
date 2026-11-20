import { EnAuditLogMessages } from '../../../audit/i18n/EnAuditLogMessages';
import { EnAuthMessages } from '../../../auth/i18n/EnAuthMessages';
import { EnCourseMessages } from '../../../course/i18n/EnCourseMessages';
import { EnParticipantMessages } from '../../../course/participants/i18n/EnParticipantMessages';
import { EnHomeMessages } from '../../../home/i18n/EnHomeMessages';
import { EnUserMessages } from '../../../user/i18n/EnUserMessages';
import type { AdminMessages } from './AdminMessages';
import { EnAppMessages } from './EnAppMessages';

export const EnAdminMessages = {
  ...EnAppMessages,
  ...EnAuthMessages,
  ...EnHomeMessages,
  ...EnCourseMessages,
  ...EnParticipantMessages,
  ...EnUserMessages,
  ...EnAuditLogMessages,
} satisfies AdminMessages;
