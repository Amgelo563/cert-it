import type { FieldValues } from '../../field/FieldValue';
import type { ParticipantCertificate } from './ParticipantCertificate';

/** A participant of a course, as the participant routes return it. */
export type ParticipantSummary = {
  readonly id: number;
  readonly courseId: number;
  readonly name: string;
  /** Trimmed and lowercased. */
  readonly email: string;
  /** Values of the course's fields, by field ID. */
  readonly fieldValues: FieldValues;
  /** Their certificate, or null if none was issued. */
  readonly certificate: ParticipantCertificate | null;
  /** ISO 8601 date and time. */
  readonly createdAt: string;
};
