import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import type { CourseFieldType } from '@cert-it/shared';
import type { Result } from 'better-result';
import type { CourseId } from '../../course/Course';
import type { CourseField, CourseFieldId } from '../CourseField';

/** An object that stores and queries the fields of courses. */
export interface CourseFieldRepository {
  /** Returns the field with the given ID, or null if there's none. */
  findById(id: CourseFieldId): CourseField | null;

  /** Returns the fields of a course, in their order. */
  listByCourse(courseId: CourseId): CourseField[];

  /** Returns the fields of every course with the given type. */
  listByType(type: CourseFieldType): CourseField[];

  /** Creates a field, unless the course already has one with its label key. */
  create(data: {
    courseId: CourseId;
    label: string;
    labelKey: string;
    type: CourseFieldType;
    required: boolean;
    position: number;
  }): Result<CourseField, DuplicateModelError>;

  /** Updates the given parts of a field. */
  update(
    id: CourseFieldId,
    data: {
      label?: string;
      labelKey?: string;
      type?: CourseFieldType;
      required?: boolean;
      position?: number;
    },
  ): Result<CourseField, ModelNotFoundError | DuplicateModelError>;

  /** Deletes a field; its values stay with the participants until removed. */
  delete(id: CourseFieldId): Result<void, ModelNotFoundError>;
}
