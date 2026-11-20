import { email, string } from 'zod';

/** Schemas of the editable fields of a participant, shared by its requests and the CSV import. */
export const ParticipantFields = {
  name: string().trim().min(1).max(200),
  email: string().trim().max(254).pipe(email()),
};
