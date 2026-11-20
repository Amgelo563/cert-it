import type { ParticipantCertificate } from './ParticipantCertificate';

/** A participant of a course, as the participant routes return it. */
export type ParticipantSummary = {
  readonly id: number;
  readonly courseId: number;
  readonly name: string;
  /** Trimmed and lowercased. */
  readonly email: string;
  /** Extra columns imported from the CSV, by column name. */
  readonly extra: Readonly<Record<string, string>>;
  /** Their certificate, or null if none was issued. */
  readonly certificate: ParticipantCertificate | null;
  /** ISO 8601 date and time. */
  readonly createdAt: string;
};
