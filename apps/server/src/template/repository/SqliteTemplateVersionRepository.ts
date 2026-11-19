import { AbstractSqliteRepository } from '@cert-it/data';
import { and, desc, eq, ne, notExists } from 'drizzle-orm';
import { certificateTable } from '../../certificate/repository/certificateTable';
import type { CourseId } from '../../course/Course';
import type { FontId } from '../../font/Font';
import type { TemplateVersion, TemplateVersionId } from '../TemplateVersion';
import { templateVersionFontTable } from './templateVersionFontTable';
import { templateVersionTable } from './templateVersionTable';
import type { TemplateVersionRepository } from './TemplateVersionRepository';

export class SqliteTemplateVersionRepository
  extends AbstractSqliteRepository<TemplateVersion, typeof templateVersionTable>
  implements TemplateVersionRepository
{
  protected readonly table = templateVersionTable;

  public findLatest(courseId: CourseId): TemplateVersion | null {
    const row = this.db
      .select()
      .from(templateVersionTable)
      .where(eq(templateVersionTable.courseId, courseId))
      .orderBy(desc(templateVersionTable.version))
      .limit(1)
      .get();

    return row ? this.toModel(row) : null;
  }

  public listByCourse(courseId: CourseId): TemplateVersion[] {
    return this.db
      .select()
      .from(templateVersionTable)
      .where(eq(templateVersionTable.courseId, courseId))
      .orderBy(desc(templateVersionTable.version))
      .all()
      .map((row) => this.toModel(row));
  }

  public listUnused(courseId: CourseId): TemplateVersion[] {
    const latest = this.findLatest(courseId);
    if (!latest) return [];

    return this.db
      .select()
      .from(templateVersionTable)
      .where(
        and(
          eq(templateVersionTable.courseId, courseId),
          ne(templateVersionTable.id, latest.id),
          notExists(
            this.db
              .select({ id: certificateTable.id })
              .from(certificateTable)
              .where(
                eq(certificateTable.templateVersionId, templateVersionTable.id),
              ),
          ),
        ),
      )
      .orderBy(templateVersionTable.version)
      .all()
      .map((row) => this.toModel(row));
  }

  public listFontIds(id: TemplateVersionId): FontId[] {
    return this.db
      .select({ fontId: templateVersionFontTable.fontId })
      .from(templateVersionFontTable)
      .where(eq(templateVersionFontTable.templateVersionId, id))
      .orderBy(templateVersionFontTable.fontId)
      .all()
      .map(({ fontId }) => fontId);
  }

  public setFontIds(id: TemplateVersionId, fontIds: readonly FontId[]): void {
    this.db
      .delete(templateVersionFontTable)
      .where(eq(templateVersionFontTable.templateVersionId, id))
      .run();

    if (fontIds.length === 0) return;

    this.db
      .insert(templateVersionFontTable)
      .values(
        [...new Set(fontIds)].map((fontId) => ({
          templateVersionId: id,
          fontId,
        })),
      )
      .run();
  }

  protected toModel(
    row: typeof templateVersionTable.$inferSelect,
  ): TemplateVersion {
    return row;
  }
}
