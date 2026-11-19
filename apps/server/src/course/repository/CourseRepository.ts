import type {
  DuplicateModelError,
  ModelNotFoundError,
  Page,
  PageRequest,
} from '@cert-it/data';
import type { Result } from 'better-result';
import type { Locale } from '../../config/schema/enums/LocaleEnum';
import type { Course, CourseId } from '../Course';

/** An object that stores and queries courses. */
export interface CourseRepository {
  /** Returns the course with the given ID, or null if there's none. */
  findById(id: CourseId): Course | null;

  /** Creates a course. */
  create(data: {
    name: string;
    locale: Locale;
    dateFormat: string;
    lookupEnabled?: boolean;
    active?: boolean;
  }): Result<Course, DuplicateModelError>;

  /** Updates the given fields of a course. */
  update(
    id: CourseId,
    data: {
      name?: string;
      locale?: Locale;
      dateFormat?: string;
      lookupEnabled?: boolean;
      active?: boolean;
    },
  ): Result<Course, ModelNotFoundError | DuplicateModelError>;

  /** Deletes a course with its participants, template versions, certificates and jobs. */
  delete(id: CourseId): Result<void, ModelNotFoundError>;

  /** Returns a page of courses, newest first. */
  list(page: PageRequest): Page<Course>;

  /** Returns the active courses listed in the public lookup, sorted by name. */
  listForLookup(): Course[];
}
