import { type output, strictObject } from 'zod';
import { FieldValuesInputSchema } from '../field/FieldValuesInput';
import { ParticipantFields } from './ParticipantFields';

export const UpdateParticipantRequestSchema = strictObject({
  name: ParticipantFields.name.optional(),
  email: ParticipantFields.email.optional(),
  /** Values to set, or null to clear; fields left out keep theirs. */
  fieldValues: FieldValuesInputSchema.optional(),
}).refine(
  (body) =>
    body.name !== undefined
    || body.email !== undefined
    || body.fieldValues !== undefined,
  { message: 'Nothing to update' },
);

/** The body of a request to change a participant's name, email or field values. */
export type UpdateParticipantRequest = output<
  typeof UpdateParticipantRequestSchema
>;
