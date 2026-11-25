import {
  AuditActionEnum,
  AuditEntityEnum,
  type TemplateContent,
} from '@cert-it/shared';
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

/** Saves a course's template as its next version, linked to the fonts its text fields use, and writes it to the audit log. */
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
   * Saves the template as the course's next version, in one transaction with its fonts and audit entry.
   *
   * @throws {Error} If a font isn't stored, or the version can't be created.
   */
  public save(options: {
    courseId: CourseId;
    template: TemplateContent;
    basePdfPath: string;
    userId: UserId;
  }): TemplateVersion {
    const { courseId, template, basePdfPath, userId } = options;
    const fonts = this.findFonts(template);
    if (!fonts)
      throw new Error('A field of the template names an unknown font.');

    return this.database
      .getUnitOfWork()
      .transaction(({ templateVersions }) => {
        const version =
          (templateVersions.findLatest(courseId)?.version ?? 0) + 1;
        return templateVersions
          .create({
            courseId,
            version,
            template,
            basePdfPath,
            createdBy: userId,
          })
          .map((created) => {
            templateVersions.setFontIds(
              created.id,
              fonts.map((font) => font.id),
            );
            this.auditLog.record({
              userId,
              action: AuditActionEnum.Create,
              entity: AuditEntityEnum.TemplateVersion,
              entityId: created.id,
              details: { courseId, version: created.version },
            });
            return created;
          });
      })
      .unwrap();
  }
}
