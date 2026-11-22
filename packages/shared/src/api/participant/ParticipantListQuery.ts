import { enum as zEnum, type output, string } from 'zod';
import { PageQuerySchema } from '../PageQuery';
import { ParticipantCertificateFilterEnum } from './ParticipantCertificateFilterEnum';

export const ParticipantListQuerySchema = PageQuerySchema.extend({
  /** Text to find in the name or email. */
  search: string().trim().max(200).optional(),
  /** Only participants whose certificate is in this state. */
  certificate: zEnum(ParticipantCertificateFilterEnum).optional(),
});

/** The query of the route that lists a course's participants. */
export type ParticipantListQuery = output<typeof ParticipantListQuerySchema>;
