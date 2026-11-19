import { AbstractSqliteRepository } from '@cert-it/data';
import { eq, notExists } from 'drizzle-orm';
import { templateVersionFontTable } from '../../template/repository/templateVersionFontTable';
import type { Font } from '../Font';
import { fontTable } from './fontTable';
import type { FontRepository } from './FontRepository';

export class SqliteFontRepository
  extends AbstractSqliteRepository<Font, typeof fontTable>
  implements FontRepository
{
  protected readonly table = fontTable;

  public findBySha256(sha256: string): Font | null {
    const row = this.db
      .select()
      .from(fontTable)
      .where(eq(fontTable.sha256, sha256))
      .get();

    return row ? this.toModel(row) : null;
  }

  public list(): Font[] {
    return this.db
      .select()
      .from(fontTable)
      .orderBy(fontTable.family, fontTable.style)
      .all()
      .map((row) => this.toModel(row));
  }

  public listUnused(): Font[] {
    return this.db
      .select()
      .from(fontTable)
      .where(
        notExists(
          this.db
            .select({ fontId: templateVersionFontTable.fontId })
            .from(templateVersionFontTable)
            .where(eq(templateVersionFontTable.fontId, fontTable.id)),
        ),
      )
      .orderBy(fontTable.id)
      .all()
      .map((row) => this.toModel(row));
  }

  protected toModel(row: typeof fontTable.$inferSelect): Font {
    return row;
  }
}
