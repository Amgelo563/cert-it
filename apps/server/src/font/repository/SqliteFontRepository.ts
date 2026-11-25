import { AbstractSqliteRepository } from '@cert-it/data';
import { FontSourceEnum } from '@cert-it/shared';
import { and, eq, ne, notExists } from 'drizzle-orm';
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
      // bundled fonts stay, as they're meant to be there before any template uses them
      where: and(
        ne(fontTable.source, FontSourceEnum.Bundled),
        notExists(
          this.db
            .select({ fontId: templateVersionFontTable.fontId })
            .from(templateVersionFontTable)
            .where(eq(templateVersionFontTable.fontId, fontTable.id)),
        ),
      ),
    });
  }

  protected toModel(row: typeof fontTable.$inferSelect): Font {
    return row;
  }
}
