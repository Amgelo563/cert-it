import { DatabaseService } from '../../../src/database/DatabaseService';

/** Returns a started in-memory database with the app's migrations applied. */
export function createTestDatabase(): DatabaseService {
  const database = new DatabaseService({ path: ':memory:' });
  database.start();

  return database;
}
