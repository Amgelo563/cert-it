import { array, int, iso, type output, strictObject } from 'zod';
import { MaxImportRows } from '../participant/ImportParticipantsRequest';

export const IssueCertificatesRequestSchema = strictObject({
  /** Participants to issue to. Omitted: every participant of the course without a certificate. */
  participantIds: array(int().positive()).min(1).max(MaxImportRows).optional(),
  /** The date to print, as `YYYY-MM-DD`. Omitted: today on the server. */
  issueDate: iso.date().optional(),
});

/** The body of a request to issue certificates as a background job. */
export type IssueCertificatesRequest = output<
  typeof IssueCertificatesRequestSchema
>;
