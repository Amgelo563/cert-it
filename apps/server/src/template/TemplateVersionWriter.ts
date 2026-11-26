import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import {
  AuditActionEnum,
  AuditEntityEnum,
  type TemplateContent,
} from '@cert-it/shared';
import type { Result } from 'better-result';
import type { AuditLog } from '../audit/AuditLog';
import type { CourseId } from '../course/Course';
import type { DatabaseService } from '../database/DatabaseService';
import type { Font } from '../font/Font';
import type { UserId } from '../user/User';
import { listTextFields } from './TemplateTextField';
import type { TemplateVersion } from './TemplateVersion';

type TemplateVersionWriterOptions = {
  database: DatabaseService;
  auditLog: AuditLog;
};

/** The result of saving a template: the version, and whether it's a new one. */
export type SavedTemplateVersion = {
  readonly version: TemplateVersion;
  /** False if the latest version had no certificates and was replaced in place. */
  readonly created: boolean;
};

/** Saves a course's template, linked to the fonts its text fields use, and writes it to the audit log. */
export class TemplateVersionWriter {
  protected readonly database: DatabaseService;

  protected readonly auditLog: AuditLog;

  constructor(options: TemplateVersionWriterOptions) {
    this.database = options.database;
    this.auditLog = options.auditLog;
  }

  /** Returns the stored fonts a template's text fields use, or null if one isn't stored. */
  public findFonts(template: TemplateContent): Font[] | null {
    const { fonts } = this.database.getRepositories();
    const hashes = new Set(
      listTextFields(template).map((field) => field.fontName),
    );
    const found = [...hashes].map((sha256) => fonts.findBySha256(sha256));

    return found.every((font) => font !== null) ? found : null;
  }

  /**
   * Saves the template in one transaction with its fonts and audit entry.
   * Replaces the latest version if no certificate uses it, else creates the next one.
   *
   * @throws {Error} If a font isn't stored, or the version can't be created.
   */
  public save(options: {
    courseId: CourseId;
    template: TemplateContent;
    basePdfPath: string;
    userId: UserId;
  }): SavedTemplateVersion {
    const { courseId, template, basePdfPath, userId } = options;
    const fonts = this.findFonts(template);
    if (!fonts)
      throw new Error('A field of the template names an unknown font.');

    return this.database
      .getUnitOfWork()
      .transaction(({ templateVersions }) => {
        const latest = templateVersions.findLatest(courseId);
        const replaced = latest && !templateVersions.isUsed(latest.id);

        const saved: Result<
          TemplateVersion,
          ModelNotFoundError | DuplicateModelError
        > = replaced
          ? templateVersions.update(latest.id, { template, basePdfPath })
          : templateVersions.create({
              courseId,
              version: (latest?.version ?? 0) + 1,
              template,
              basePdfPath,
              createdBy: userId,
            });

        return saved.map((version) => {
          templateVersions.setFontIds(
            version.id,
            fonts.map((font) => font.id),
          );
          this.auditLog.record({
            userId,
            action: replaced ? AuditActionEnum.Update : AuditActionEnum.Create,
            entity: AuditEntityEnum.TemplateVersion,
            entityId: version.id,
            details: { courseId, version: version.version },
          });
          return { version, created: !replaced };
        });
      })
      .unwrap();
  }
}
