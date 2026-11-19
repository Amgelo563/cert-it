import type { ParticipantId } from '../participant/Participant';

/** The input of a job that issues certificates. */
export type IssueJobPayload = {
  readonly participantIds: readonly ParticipantId[];
  /** The date printed on the certificates, as `YYYY-MM-DD`. */
  readonly issueDate: string;
};
