import { type output, strictObject } from 'zod';
import { ParticipantFields } from './ParticipantFields';

export const UpdateParticipantRequestSchema = strictObject({
  name: ParticipantFields.name.optional(),
  email: ParticipantFields.email.optional(),
}).refine((body) => body.name !== undefined || body.email !== undefined, {
  message: 'Nothing to update',
});

/** The body of a request to change a participant's name or email. */
export type UpdateParticipantRequest = output<
  typeof UpdateParticipantRequestSchema
>;
