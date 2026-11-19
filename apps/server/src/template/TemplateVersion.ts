import type { Template } from '@pdfme/common';
import type { Brand } from '@cert-it/shared';
import type { CourseId } from '../course/Course';
import type { UserId } from '../user/User';

export type TemplateVersionId = Brand<number, 'TemplateVersionId'>;

/** One saved version of a course's certificate template, kept while certificates use it. */
export type TemplateVersion = {
  readonly id: TemplateVersionId;
  readonly courseId: CourseId;
  /** Version number within the course, starting at 1. */
  readonly version: number;
  /** The pdfme template, without its base PDF, which is stored at {@link TemplateVersion.basePdfPath}. */
  readonly template: Omit<Template, 'basePdf'>;
  /** Path of the base PDF, relative to the data directory. */
  readonly basePdfPath: string;
  readonly createdBy: UserId;
  readonly createdAt: Date;
};
