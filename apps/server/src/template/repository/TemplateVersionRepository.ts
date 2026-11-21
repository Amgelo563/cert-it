import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import type { Template } from '@pdfme/common';
import type { Result } from 'better-result';
import type { CourseId } from '../../course/Course';
import type { FontId } from '../../font/Font';
import type { UserId } from '../../user/User';
import type { TemplateVersion, TemplateVersionId } from '../TemplateVersion';

/** An object that stores and queries the template versions of courses. */
export interface TemplateVersionRepository {
  /** Returns the template version with the given ID, or null if there's none. */
  findById(id: TemplateVersionId): TemplateVersion | null;

  /** Returns the newest template version of a course, or null if it has none. */
  findLatest(courseId: CourseId): TemplateVersion | null;

  /** Returns the version number of each given template version, leaving out missing ones. */
  findVersionNumbers(
    ids: readonly TemplateVersionId[],
  ): ReadonlyMap<TemplateVersionId, number>;

  /** Returns the newest version number of each given course, leaving out courses with none. */
  findLatestVersionNumbers(
    courseIds: readonly CourseId[],
  ): ReadonlyMap<CourseId, number>;

  /** Creates a template version, unless the course already has one with that number. */
  create(data: {
    courseId: CourseId;
    version: number;
    template: Omit<Template, 'basePdf'>;
    basePdfPath: string;
    createdBy: UserId;
  }): Result<TemplateVersion, DuplicateModelError>;

  /**
   * Deletes a template version.
   *
   * @throws {Error} If a certificate still uses it.
   */
  delete(id: TemplateVersionId): Result<void, ModelNotFoundError>;

  /** Returns the template versions of a course, newest first. */
  listByCourse(courseId: CourseId): TemplateVersion[];

  /** Returns the template versions that can be deleted: replaced by a newer version of their course saved before `replacedBefore`, and used by no certificate. */
  listUnused(replacedBefore: Date): TemplateVersion[];

  /** Returns the base PDF paths every template version uses, each once. */
  listBasePdfPaths(): string[];

  /** Returns the IDs of the fonts a template version uses. */
  listFontIds(id: TemplateVersionId): FontId[];

  /** Replaces the fonts a template version uses. */
  setFontIds(id: TemplateVersionId, fontIds: readonly FontId[]): void;
}
