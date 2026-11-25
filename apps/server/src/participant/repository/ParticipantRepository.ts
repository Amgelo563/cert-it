import type {
  DuplicateModelError,
  ModelNotFoundError,
  Page,
  PageRequest,
} from '@cert-it/data';
import type {
  FieldValues,
  ParticipantCertificateFilter,
} from '@cert-it/shared';
import type { Result } from 'better-result';
import type { CourseId } from '../../course/Course';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { Participant, ParticipantId } from '../Participant';

/** An object that stores and queries course participants. */
export interface ParticipantRepository {
  /** Returns the participant with the given ID, or null if there's none. */
  findById(id: ParticipantId): Participant | null;

  /** Returns the participants with the given IDs, skipping missing ones. */
  findByIds(ids: readonly ParticipantId[]): Participant[];

  /** Returns the participant of a course with the given email, or null if there's none. */
  findByEmail(courseId: CourseId, email: NormalizedEmail): Participant | null;

  /** Returns the participants of a course with any of the given emails. */
  listByEmails(
    courseId: CourseId,
    emails: readonly NormalizedEmail[],
  ): Participant[];

  /** Creates a participant, unless the course already has one with that email. */
  create(data: {
    courseId: CourseId;
    name: string;
    email: NormalizedEmail;
    fieldValues?: FieldValues;
  }): Result<Participant, DuplicateModelError>;

  /** Updates the given fields of a participant. */
  update(
    id: ParticipantId,
    data: {
      name?: string;
      email?: NormalizedEmail;
      fieldValues?: FieldValues;
    },
  ): Result<Participant, ModelNotFoundError | DuplicateModelError>;

  /** Deletes a participant with their certificate. */
  delete(id: ParticipantId): Result<void, ModelNotFoundError>;

  /** Returns a page of the participants of a course, sorted by name, optionally only those whose name or email contains the search text, or whose certificate is in the given state. */
  listByCourse(
    courseId: CourseId,
    page: PageRequest,
    search?: string,
    certificate?: ParticipantCertificateFilter,
  ): Page<Participant>;

  /** Returns the participants of a course who have no certificate, sorted by name. */
  listWithoutCertificate(courseId: CourseId): Participant[];

  /** Returns how many participants of a course have a value for each field, by field ID, leaving out fields with none. */
  countFieldValues(courseId: CourseId): ReadonlyMap<string, number>;

  /** Removes a field's value from every participant of a course, returning how many had one. */
  removeFieldValue(courseId: CourseId, fieldId: number): number;

  /** Returns every value of the given fields, with the course of its participant. */
  listFieldValues(
    fieldIds: readonly number[],
  ): { courseId: CourseId; value: FieldValues[string] }[];

  /** Returns the number of participants of each given course, leaving out courses with none. */
  countByCourses(courseIds: readonly CourseId[]): ReadonlyMap<CourseId, number>;
}
