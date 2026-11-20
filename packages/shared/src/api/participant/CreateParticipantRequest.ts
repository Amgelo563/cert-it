import { type output, strictObject } from 'zod';
import { ParticipantFields } from './ParticipantFields';

export const CreateParticipantRequestSchema = strictObject({
  name: ParticipantFields.name,
  email: ParticipantFields.email,
});

/** The body of a request to add a participant to a course. */
export type CreateParticipantRequest = output<
  typeof CreateParticipantRequestSchema
>;
