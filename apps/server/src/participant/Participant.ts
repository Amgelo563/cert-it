import type { Brand, FieldValues } from '@cert-it/shared';
import type { CourseId } from '../course/Course';
import type { NormalizedEmail } from '../util/email/NormalizedEmail';

export type ParticipantId = Brand<number, 'ParticipantId'>;

/** A person enrolled in a course, who can receive its certificate. */
export type Participant = {
  readonly id: ParticipantId;
  readonly courseId: CourseId;
  readonly name: string;
  /** Unique per course, used only for the public lookup. */
  readonly email: NormalizedEmail;
  /** Values of the course's fields, by field ID. */
  readonly fieldValues: FieldValues;
  readonly createdAt: Date;
};
