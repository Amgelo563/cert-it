import type { ImportParticipantsResponse } from '@cert-it/shared';
import type { Participant } from '../Participant';

/** A saved participant whose certificate may need rendering again: their name, or the values of some fields, changed. */
export type ParticipantChange = {
  readonly participant: Participant;
  readonly renamed: boolean;
  /** IDs of the fields whose value changed. */
  readonly fieldIds: readonly number[];
};

/** What an import did: the report for the panel, and what else must follow from it. */
export type ImportOutcome = {
  readonly response: ImportParticipantsResponse;
  /** Updated participants whose name or field values changed, as saved; empty on a dry run. */
  readonly changed: readonly ParticipantChange[];
};
