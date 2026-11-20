import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sqliteJobColumns } from '../../../src/sqlite/table/sqliteJobColumns';
import { sqliteJobIndexes } from '../../../src/sqlite/table/sqliteJobIndexes';
import type { TestJobPayload, TestJobType } from './TestJob';

export const testJobTable = sqliteTable(
  'test_jobs',
  {
    ...sqliteJobColumns<TestJobType, TestJobPayload>(),
    owner: text('owner').notNull(),
  },
  (table) => [...sqliteJobIndexes(table, 'test_jobs')],
);

/** The table above as SQL, for an in-memory database without migrations. */
export const TestJobTableSql = `
  CREATE TABLE test_jobs (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    type text NOT NULL,
    payload text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    total integer,
    output text,
    error text,
    created_at integer NOT NULL,
    started_at integer,
    finished_at integer,
    owner text NOT NULL
  );
  CREATE INDEX test_jobs_status_id_index ON test_jobs (status, id);
`;
