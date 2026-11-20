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
    return this.findOne({ where: eq(fontTable.sha256, sha256) });
  }

  public list(): Font[] {
    return this.findMany({ orderBy: [fontTable.family, fontTable.style] });
  }

  public listUnused(): Font[] {
    return this.findMany({
      where: notExists(
        this.db
          .select({ fontId: templateVersionFontTable.fontId })
          .from(templateVersionFontTable)
          .where(eq(templateVersionFontTable.fontId, fontTable.id)),
      ),
    });
  }

  protected toModel(row: typeof fontTable.$inferSelect): Font {
    return row;
  }
}
