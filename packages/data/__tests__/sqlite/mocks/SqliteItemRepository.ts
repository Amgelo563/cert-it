import { Result } from 'better-result';
import { desc, eq, sql } from 'drizzle-orm';
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

  public findBySlug(slug: string): Item | null {
    return this.findOne({ where: eq(itemTable.slug, slug) });
  }

  public findLastInGroup(groupId: number): Item | null {
    return this.findOne({
      where: eq(itemTable.groupId, groupId),
      orderBy: [desc(itemTable.position)],
    });
  }

  public listAll(): Item[] {
    return this.findMany();
  }

  public listAllByGroup(groupId: number): Item[] {
    return this.findMany({
      where: eq(itemTable.groupId, groupId),
      orderBy: [itemTable.position],
    });
  }

  public countAll(): number {
    return this.count();
  }

  public countByGroup(groupId: number): number {
    return this.count(eq(itemTable.groupId, groupId));
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
