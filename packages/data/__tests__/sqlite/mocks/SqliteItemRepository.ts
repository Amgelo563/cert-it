import { eq } from 'drizzle-orm';
import type { Page } from '../../../src/shared/page/Page';
import type { PageRequest } from '../../../src/shared/page/PageRequest';
import { AbstractSqliteRepository } from '../../../src/sqlite/repository/AbstractSqliteRepository';
import type { Item } from './Item';
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

  protected toModel(row: typeof itemTable.$inferSelect): Item {
    return row;
  }
}
