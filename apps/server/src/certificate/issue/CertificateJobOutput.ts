import type { SkippedParticipant } from './SkippedParticipant';

/** What an issue or regenerate job saves when it ends. */
export type CertificateJobOutput = {
  /** How many certificates this run rendered. */
  readonly rendered: number;
  readonly skipped: readonly SkippedParticipant[];
};
