import { AbstractSqliteRepository } from '@cert-it/data';
import {
  and,
  desc,
  eq,
  exists,
  gt,
  inArray,
  lte,
  max,
  notExists,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
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
    return this.findOne({
      where: eq(templateVersionTable.courseId, courseId),
      orderBy: [desc(templateVersionTable.version)],
    });
  }

  public findVersionNumbers(
    ids: readonly TemplateVersionId[],
  ): ReadonlyMap<TemplateVersionId, number> {
    const rows = this.db
      .select({
        id: templateVersionTable.id,
        version: templateVersionTable.version,
      })
      .from(templateVersionTable)
      .where(inArray(templateVersionTable.id, [...ids]))
      .all();

    return new Map(rows.map(({ id, version }) => [id, version]));
  }

  public findLatestVersionNumbers(
    courseIds: readonly CourseId[],
  ): ReadonlyMap<CourseId, number> {
    const rows = this.db
      .select({
        courseId: templateVersionTable.courseId,
        latest: max(templateVersionTable.version),
      })
      .from(templateVersionTable)
      .where(inArray(templateVersionTable.courseId, [...courseIds]))
      .groupBy(templateVersionTable.courseId)
      .all();

    return new Map(
      rows.flatMap(({ courseId, latest }) =>
        latest === null ? [] : [[courseId, latest] as const],
      ),
    );
  }

  public listByCourse(courseId: CourseId): TemplateVersion[] {
    return this.findMany({
      where: eq(templateVersionTable.courseId, courseId),
      orderBy: [desc(templateVersionTable.version)],
    });
  }

  public listUnused(replacedBefore: Date): TemplateVersion[] {
    const newer = alias(templateVersionTable, 'newer');

    return this.findMany({
      where: and(
        exists(
          this.db
            .select({ id: newer.id })
            .from(newer)
            .where(
              and(
                eq(newer.courseId, templateVersionTable.courseId),
                gt(newer.version, templateVersionTable.version),
                lte(newer.createdAt, replacedBefore),
              ),
            ),
        ),
        notExists(
          this.db
            .select({ id: certificateTable.id })
            .from(certificateTable)
            .where(
              eq(certificateTable.templateVersionId, templateVersionTable.id),
            ),
        ),
      ),
      orderBy: [templateVersionTable.courseId, templateVersionTable.version],
    });
  }

  public listBasePdfPaths(): string[] {
    return this.db
      .selectDistinct({ path: templateVersionTable.basePdfPath })
      .from(templateVersionTable)
      .all()
      .map(({ path }) => path);
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
