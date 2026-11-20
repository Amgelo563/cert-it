import type { SqliteExecutor } from '@cert-it/data';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SqliteJobQueue } from '../../../src/sqlite/queue/SqliteJobQueue';
import type { TestJob, TestJobPayload, TestJobType } from './TestJob';
import { testJobTable, TestJobTableSql } from './testJobTable';

export type TestJobDatabase = {
  db: SqliteExecutor;
  queue: SqliteJobQueue<TestJob, typeof testJobTable>;
  /** Adds a pending job of the given type. */
  add: (type: TestJobType, payload?: TestJobPayload) => TestJob;
  close: () => void;
};

/** A job queue on a fresh in-memory database, with a helper that adds pending jobs. */
export function createTestJobQueue(): TestJobDatabase {
  const client = new BetterSqlite3(':memory:');
  client.exec(TestJobTableSql);
  const db = drizzle({ client });
  const queue = new SqliteJobQueue<TestJob, typeof testJobTable>({
    db,
    table: testJobTable,
  });

  const add = (type: TestJobType, payload: TestJobPayload = {}): TestJob =>
    queue.enqueue({ type, payload, owner: 'test' }).unwrap();

  return { db, queue, add, close: () => client.close() };
}
