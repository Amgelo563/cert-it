import { iso, type output, strictObject } from 'zod';
import { ParticipantFields } from '../participant/ParticipantFields';

export const UpdateCertificateRequestSchema = strictObject({
  /** The participant's name, as printed on the certificate. */
  name: ParticipantFields.name.optional(),
  /** The date printed on it, as `YYYY-MM-DD`. */
  issueDate: iso.date().optional(),
}).refine((body) => body.name !== undefined || body.issueDate !== undefined, {
  message: 'Nothing to update',
});

/** The body of a request to fix a certificate's printed name or date, which renders it again. */
export type UpdateCertificateRequest = output<
  typeof UpdateCertificateRequestSchema
>;
