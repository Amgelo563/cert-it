import { Result } from 'better-result';
import { eq, sql } from 'drizzle-orm';
import type { DuplicateModelError } from '../../../src/shared/errors/DuplicateModelError';
import type { Page } from '../../../src/shared/page/Page';
import type { PageRequest } from '../../../src/shared/page/PageRequest';
import { AbstractSqliteRepository } from '../../../src/sqlite/repository/AbstractSqliteRepository';
import type { Item, ItemId } from './Item';
import { itemTable } from './itemTable';

export class SqliteItemRepository extends AbstractSqliteRepository<
  Item,
  typeof itemTable
> {
  protected readonly table = itemTable;

  public listByGroup(groupId: number, page: PageRequest): Page<Item> {
    return this.findPage(page, {
      where: eq(itemTable.groupId, groupId),
      orderBy: [itemTable.position],
    });
  }

  public renameSlugWithRawSql(
    id: ItemId,
    slug: string,
  ): Result<void, DuplicateModelError> {
    try {
      this.db.run(sql`UPDATE items SET slug = ${slug} WHERE id = ${id}`);
      return Result.ok(undefined);
    } catch (error) {
      return Result.err(this.toDuplicateErrorOrThrow(error));
    }
  }

  protected toModel(row: typeof itemTable.$inferSelect): Item {
    return row;
  }
}
