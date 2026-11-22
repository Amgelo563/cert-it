import { array, int, type output, strictObject } from 'zod';
import { MaxImportRows } from '../participant/ImportParticipantsRequest';

export const RegenerateCertificatesRequestSchema = strictObject({
  /** Certificates to move to the latest template. Omitted: every certificate on an older version. */
  certificateIds: array(int().positive()).min(1).max(MaxImportRows).optional(),
});

/** The body of a request to render certificates again with the course's latest template. */
export type RegenerateCertificatesRequest = output<
  typeof RegenerateCertificatesRequestSchema
>;
