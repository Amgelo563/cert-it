import { type output, strictObject } from 'zod';
import { FieldValuesInputSchema } from '../field/FieldValuesInput';
import { ParticipantFields } from './ParticipantFields';

export const CreateParticipantRequestSchema = strictObject({
  name: ParticipantFields.name,
  email: ParticipantFields.email,
  /** Values of the course's fields, which must include the required ones. */
  fieldValues: FieldValuesInputSchema.optional(),
});

/** The body of a request to add a participant to a course. */
export type CreateParticipantRequest = output<
  typeof CreateParticipantRequestSchema
>;
