/** A certificate rendered with an older template version than the course's latest. */
export type OutdatedCertificate = {
  readonly id: number;
  readonly code: string;
  readonly participantId: number;
  /** The participant's name. */
  readonly name: string;
  /** Number of the template version it was rendered with. */
  readonly templateVersion: number;
};
