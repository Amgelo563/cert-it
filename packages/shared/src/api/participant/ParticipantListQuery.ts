import { type output, string } from 'zod';
import { PageQuerySchema } from '../PageQuery';

export const ParticipantListQuerySchema = PageQuerySchema.extend({
  /** Text to find in the name or email. */
  search: string().trim().max(200).optional(),
});

/** The query of the route that lists a course's participants. */
export type ParticipantListQuery = output<typeof ParticipantListQuerySchema>;
