import { EsAuditLogMessages } from '../../../audit/i18n/EsAuditLogMessages';
import { EsAuthMessages } from '../../../auth/i18n/EsAuthMessages';
import { EsCourseMessages } from '../../../course/i18n/EsCourseMessages';
import { EsCertificateMessages } from '../../../course/certificates/i18n/EsCertificateMessages';
import { EsParticipantMessages } from '../../../course/participants/i18n/EsParticipantMessages';
import { EsUserMessages } from '../../../user/i18n/EsUserMessages';
import type { AdminMessages } from './AdminMessages';
import { EsAppMessages } from './EsAppMessages';

export const EsAdminMessages = {
  ...EsAppMessages,
  ...EsAuthMessages,
  ...EsCourseMessages,
  ...EsParticipantMessages,
  ...EsCertificateMessages,
  ...EsUserMessages,
  ...EsAuditLogMessages,
} satisfies AdminMessages;
