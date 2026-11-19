import { join } from 'node:path';
import type { SqliteDatabase } from '@cert-it/data';
import { createDatabase } from '../../../src/database/createDatabase';
import type { Repositories } from '../../../src/database/Repositories';

const MigrationsFolder = join(import.meta.dirname, '../../../drizzle');

/** Returns a started in-memory database with the app's migrations applied. */
export function createTestDatabase(): SqliteDatabase<Repositories> {
  const database = createDatabase({
    path: ':memory:',
    migrationsFolder: MigrationsFolder,
  });
  database.start();

  return database;
}
