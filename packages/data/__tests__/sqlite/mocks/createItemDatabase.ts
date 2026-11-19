import { join } from 'node:path';
import { SqliteDatabase } from '../../../src/sqlite/database/SqliteDatabase';
import { SqliteItemRepository } from './SqliteItemRepository';

export type ItemRepositories = { items: SqliteItemRepository };

export const ItemMigrationsFolder = join(
  import.meta.dirname,
  'migrations',
  'items',
);

export function createItemDatabase(): SqliteDatabase<ItemRepositories> {
  const database = SqliteDatabase.create({
    path: ':memory:',
    migrationsFolder: ItemMigrationsFolder,
    createRepositories: (db) => ({ items: new SqliteItemRepository({ db }) }),
  });
  database.start();

  return database;
}
