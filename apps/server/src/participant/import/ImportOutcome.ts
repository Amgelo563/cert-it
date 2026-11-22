import type { ImportParticipantsResponse } from '@cert-it/shared';
import type { Participant } from '../Participant';

/** What an import did: the report for the panel, and what else must follow from it. */
export type ImportOutcome = {
  readonly response: ImportParticipantsResponse;
  /** Participants whose name changed, as saved; empty on a dry run. */
  readonly renamed: readonly Participant[];
};
